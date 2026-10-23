import { context, reddit, redis } from '@devvit/web/server'
import { Hono } from 'hono'
import { LOGIN_REQUIRED_CODE } from '../../shared/submit'
import type { Grid } from '../../shared/types/puzzle'
import { isValidAttemptId, validateGrid } from '../../shared/validator'
import { getUTCWeekId } from '../../shared/growth'
import { recordHourlySolve } from '../core/baseline'
import {
  getPlayerContext,
  normalizeAndLabelSolve,
  recordDailyCompletion,
  recordGrowthEvent,
  consumeStreakFreeze,
  updateEarnedStreakFreeze
} from '../lib/growth'
import {
  claimSubmitAttempt,
  releaseSubmitAttempt,
  saveSubmitResponse,
  type SubmitAttempt
} from '../lib/submit-attempts'
import {
  hasReferredOpenToday,
  trackReferredConversion
} from '../lib/viral-analytics'
import {
  DECIMAL_RADIX,
  DEFAULT_DIFFICULTY,
  HTTP_BAD_REQUEST,
  HTTP_CONFLICT,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  isDifficultyValue,
  leaderboardKey,
  leaderboardMetaKey,
  StoredLeaderboardMeta,
  todayISO
} from './utils'

const app = new Hono()

app.post('/api/submit', async (c) => {
  const body = await c.req
    .json<{
      id: string
      attemptId?: unknown
      grid: Grid
      solveTimeSeconds: number
      hintsUsed?: number
      mistakeCount?: number
      undoCount?: number
      scoringVersion?: unknown
    }>()
    .catch(() => null)
  if (
    !body ||
    typeof body.id !== 'string' ||
    !isValidAttemptId(body.attemptId) ||
    !Array.isArray(body.grid) ||
    typeof body.solveTimeSeconds !== 'number'
  ) {
    return c.json({ error: 'invalid payload' }, HTTP_BAD_REQUEST)
  }

  const solveTimeSeconds = Number(body.solveTimeSeconds)
  if (!Number.isFinite(solveTimeSeconds) || solveTimeSeconds < 0) {
    return c.json({ error: 'invalid solve time' }, HTTP_BAD_REQUEST)
  }

  const { metrics: solveMetrics, solveQuality, scoringVersion } = normalizeAndLabelSolve({
    hintsUsed: body.hintsUsed,
    mistakeCount: body.mistakeCount,
    undoCount: body.undoCount,
    scoringVersion: body.scoringVersion
  })

  const { postId, userId } = context
  if (!postId) {
    return c.json({ error: 'postId is required' }, HTTP_BAD_REQUEST)
  }
  if (!userId) {
    return c.json({ error: 'login required', code: LOGIN_REQUIRED_CODE }, HTTP_UNAUTHORIZED)
  }

  const attempt: SubmitAttempt = { puzzleId: body.id, userId, attemptId: body.attemptId }
  let claimedAttempt = false

  try {
    const puzzleIdParts = body.id.split(':')
    const lastPart = puzzleIdParts[puzzleIdParts.length - 1]
    const difficulty =
      lastPart && isDifficultyValue(lastPart) ? (lastPart as typeof DEFAULT_DIFFICULTY) : DEFAULT_DIFFICULTY

    let puzzleData = await redis.hGetAll(
      `post:${postId}:puzzle:${difficulty}`
    )

    if (!puzzleData?.id || puzzleData.id !== body.id) {
      const oldPuzzleData = await redis.hGetAll(`post:${postId}:puzzle`)
      if (oldPuzzleData?.id && oldPuzzleData.id === body.id) {
        puzzleData = oldPuzzleData
      }
    }

    if (!puzzleData?.id || puzzleData.id !== body.id) {
      return c.json(
        { error: 'Puzzle not found or puzzle ID mismatch' },
        HTTP_BAD_REQUEST
      )
    }

    const fixed = JSON.parse(puzzleData.fixed || '[]')
    const result = validateGrid(body.grid, fixed)

    if (!result.ok) {
      return c.json({ ok: false, errors: result.errors }, HTTP_OK)
    }

    // A retry of a recorded attempt gets its first response back and records nothing.
    const claim = await claimSubmitAttempt(attempt)
    if (claim.kind === 'stored') {
      return c.json(claim.response)
    }
    if (claim.kind === 'in_progress') {
      return c.json({ error: 'submission in progress' }, HTTP_CONFLICT)
    }
    claimedAttempt = true

    const key = `submission:${postId}:${body.id}`
    const exists = await redis.get(key)
    if (!exists) {
      await redis.set(key, '1')
    }

    const currentUser = await reddit.getCurrentUser().catch(() => { })
    const username =
      currentUser?.username ||
      (await reddit.getCurrentUsername().catch(() => { })) ||
      'Unknown player'
    const avatarUrl = username
      ? await reddit.getSnoovatarUrl(username).catch(() => { })
      : undefined

    const leaderboardSetKey = leaderboardKey(body.id)
    const leaderboardDetailsKey = leaderboardMetaKey(body.id)
    const existingScore = await redis.zScore(leaderboardSetKey, userId)

    const existingMetaRaw = await redis.hGet(leaderboardDetailsKey, userId)
    const existingMeta: Partial<StoredLeaderboardMeta> = existingMetaRaw
      ? JSON.parse(existingMetaRaw)
      : {}
    // A retry of a save that failed after this write must not count its attempt twice.
    const isCountedAttempt = existingMeta.attemptId === attempt.attemptId
    const newAttempts = (existingMeta.attempts ?? 0) + (isCountedAttempt ? 0 : 1)

    if (existingScore === undefined || solveTimeSeconds < existingScore) {
      await redis.zAdd(leaderboardSetKey, {
        score: solveTimeSeconds,
        member: userId
      })
    }

    await redis.hSet(leaderboardDetailsKey, {
      [userId]: JSON.stringify({
        username,
        avatarUrl: avatarUrl ?? null,
        attempts: newAttempts,
        attemptId: attempt.attemptId
      } satisfies StoredLeaderboardMeta)
    })

    await redis.hSet(`user:meta`, {
      [userId]: JSON.stringify({ username, avatarUrl: avatarUrl ?? null })
    })

    const todayDate = todayISO()
    const lastDate = await redis.get(`user:${userId}:streak:lastDate`)

    let currentStreak = 0
    let longestStreak = 0
    let streakUpdated = false
    let streakSaved = false

    if (lastDate !== todayDate) {
      const currentStreakStr = await redis.get(`user:${userId}:streak:current`)
      currentStreak = currentStreakStr ? Number.parseInt(currentStreakStr, DECIMAL_RADIX) : 0

      const yesterday = new Date()
      yesterday.setUTCDate(yesterday.getUTCDate() - 1)
      const yesterdayDate = yesterday.toISOString().slice(0, 10)
      const dayBeforeYesterday = new Date()
      dayBeforeYesterday.setUTCDate(dayBeforeYesterday.getUTCDate() - 2)
      const dayBeforeYesterdayDate = dayBeforeYesterday.toISOString().slice(0, 10)

      if (lastDate === yesterdayDate) {
        currentStreak += 1
      } else if (lastDate === dayBeforeYesterdayDate && await consumeStreakFreeze(userId)) {
        currentStreak += 1
        streakSaved = true
      } else {
        currentStreak = 1
      }

      await redis.set(`user:${userId}:streak:current`, currentStreak.toString())
      await redis.set(`user:${userId}:streak:lastDate`, todayDate)

      const longestStr = await redis.get(`user:${userId}:streak:longest`)
      longestStreak = longestStr ? Number.parseInt(longestStr, DECIMAL_RADIX) : 0
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak
        await redis.set(`user:${userId}:streak:longest`, currentStreak.toString())
      }

      await redis.zAdd('leaderboard:streaks', { score: currentStreak, member: userId })
      streakUpdated = true
      if (streakSaved) {
        await recordGrowthEvent('streak_saved', userId, todayDate)
      }
    } else {
      const currentStreakStr = await redis.get(`user:${userId}:streak:current`)
      currentStreak = currentStreakStr ? Number.parseInt(currentStreakStr, DECIMAL_RADIX) : 0
      const longestStr = await redis.get(`user:${userId}:streak:longest`)
      longestStreak = longestStr ? Number.parseInt(longestStr, DECIMAL_RADIX) : 0
    }

    const freezeUpdate = streakUpdated
      ? await updateEarnedStreakFreeze(userId, currentStreak)
      : {
        freezes: Number.parseInt(
          (await redis.get(`user:${userId}:streak:freezes`)) ?? '0',
          DECIMAL_RADIX
        ),
        earnedFreeze: false
      }

    const dailyProgress = await recordDailyCompletion({
      userId,
      dateISOValue: todayDate,
      difficulty,
      solveTimeSeconds,
      solveQuality,
      scoringVersion
    })

    // Wire referred conversion tracking: if the user arrived via a referral
    // link today, count this puzzle completion as a referred conversion.
    // Completions on subsequent days do not count (Requirement 16.3).
    const isReferredToday = await hasReferredOpenToday(userId, todayDate)
    if (isReferredToday) {
      await trackReferredConversion(userId, todayDate)
    }

    const weekId = getUTCWeekId()
    await redis.zAdd(`leaderboard:weekly:${weekId}:${difficulty}`, {
      score: solveTimeSeconds,
      member: userId
    })
    if (dailyProgress.trio.perfectDay) {
      await redis.zAdd(`leaderboard:weekly-perfect:${weekId}`, {
        score: dailyProgress.trio.totalSolveTimeSeconds,
        member: userId
      })
    }
    await recordGrowthEvent('submit_success', userId, todayDate)
    await recordHourlySolve()

    const [userRank, totalEntries] = await Promise.all([
      redis.zRank(leaderboardSetKey, userId),
      redis.zCard(leaderboardSetKey)
    ])

    const playerContext = await getPlayerContext(userId, body.id, todayDate)

    const response = {
      ok: true,
      rank: userRank !== undefined && userRank !== null ? userRank + 1 : null,
      totalEntries,
      solveQuality,
      solveMetrics,
      dailyProgress,
      playerContext,
      streak: {
        currentStreak: currentStreak,
        longestStreak: Math.max(currentStreak, longestStreak),
        todayCompleted: lastDate === todayDate || streakUpdated,
        freezes: freezeUpdate.freezes,
        earnedFreeze: freezeUpdate.earnedFreeze,
        savedByFreeze: streakSaved
      }
    }
    await saveSubmitResponse(attempt, response)
    return c.json(response)
  } catch (error) {
    // Let a retry record the solve. If the release fails too, the claim's lease runs out.
    if (claimedAttempt) {
      await releaseSubmitAttempt(attempt).catch(() => {})
    }
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return c.json(
      { error: `Submission failed: ${errorMessage}` },
      HTTP_BAD_REQUEST
    )
  }
})

export default app
