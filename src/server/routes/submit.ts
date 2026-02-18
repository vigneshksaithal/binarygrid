import { context, reddit, redis } from '@devvit/web/server'
import { Hono } from 'hono'
import type { Grid } from '../../shared/types/puzzle'
import { validateGrid } from '../../shared/validator'
import {
  DECIMAL_RADIX,
  DEFAULT_DIFFICULTY,
  HTTP_BAD_REQUEST,
  HTTP_OK,
  isDifficultyValue,
  leaderboardKey,
  leaderboardMetaKey,
  StoredLeaderboardMeta,
  todayISO
} from './utils'

const app = new Hono()

app.post('/api/submit', async (c) => {
  const body = await c.req
    .json<{ id: string; grid: Grid; solveTimeSeconds: number }>()
    .catch(() => null)
  if (
    !body ||
    typeof body.id !== 'string' ||
    !Array.isArray(body.grid) ||
    typeof body.solveTimeSeconds !== 'number'
  ) {
    return c.json({ error: 'invalid payload' }, HTTP_BAD_REQUEST)
  }

  const solveTimeSeconds = Number(body.solveTimeSeconds)
  if (!Number.isFinite(solveTimeSeconds) || solveTimeSeconds < 0) {
    return c.json({ error: 'invalid solve time' }, HTTP_BAD_REQUEST)
  }

  const { postId, userId } = context
  if (!postId) {
    return c.json({ error: 'postId is required' }, HTTP_BAD_REQUEST)
  }
  if (!userId) {
    return c.json({ error: 'login required' }, HTTP_BAD_REQUEST)
  }

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

    if (existingScore === undefined || solveTimeSeconds < existingScore) {
      await redis.zAdd(leaderboardSetKey, {
        score: solveTimeSeconds,
        member: userId
      })
    }

    await redis.hSet(leaderboardDetailsKey, {
      [userId]: JSON.stringify({
        username,
        avatarUrl: avatarUrl ?? null
      } satisfies StoredLeaderboardMeta)
    })

    await redis.hSet(`user:${userId}:meta`, {
      username,
      avatarUrl: avatarUrl ?? ''
    })

    const todayDate = todayISO()
    const lastDate = await redis.get(`user:${userId}:streak:lastDate`)

    let currentStreak = 0
    let longestStreak = 0
    let streakUpdated = false

    if (lastDate !== todayDate) {
      const currentStreakStr = await redis.get(`user:${userId}:streak:current`)
      currentStreak = currentStreakStr ? Number.parseInt(currentStreakStr, DECIMAL_RADIX) : 0

      const yesterday = new Date()
      yesterday.setUTCDate(yesterday.getUTCDate() - 1)
      const yesterdayDate = yesterday.toISOString().slice(0, 10)

      if (lastDate === yesterdayDate) {
        currentStreak += 1
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
    } else {
      const currentStreakStr = await redis.get(`user:${userId}:streak:current`)
      currentStreak = currentStreakStr ? Number.parseInt(currentStreakStr, DECIMAL_RADIX) : 0
      const longestStr = await redis.get(`user:${userId}:streak:longest`)
      longestStreak = longestStr ? Number.parseInt(longestStr, DECIMAL_RADIX) : 0
    }

    const [userRank, totalEntries] = await Promise.all([
      redis.zRank(leaderboardSetKey, userId),
      redis.zCard(leaderboardSetKey)
    ])

    return c.json({
      ok: true,
      rank: userRank !== undefined && userRank !== null ? userRank + 1 : null,
      totalEntries,
      streak: {
        currentStreak: currentStreak,
        longestStreak: Math.max(currentStreak, longestStreak),
        todayCompleted: lastDate === todayDate || streakUpdated
      }
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return c.json(
      { error: `Submission failed: ${errorMessage}` },
      HTTP_BAD_REQUEST
    )
  }
})

export default app
