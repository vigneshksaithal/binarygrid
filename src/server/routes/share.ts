import { context, reddit, redis } from '@devvit/web/server'
import { Hono } from 'hono'
import type { SolveQuality } from '../../shared/growth'
import type { Difficulty, Grid } from '../../shared/types/puzzle'
import {
  formatReplayPostText,
  formatReplayPostTitle,
  formatScoreShareText,
  formatStreakConfessionText,
} from '../../shared/share-formatter'
import { formatTime } from '../../shared/utils/format'
import { trackFunnelEvent, trackShare } from '../lib/viral-analytics'
import {
  ensurePostIdPrefix,
  HTTP_BAD_REQUEST,
  HTTP_OK,
  isDifficultyValue,
  todayISO
} from './utils'

// ── Replay / Confession idempotency TTL ────────────────────────────────────
const SHARE_POST_TTL_SECONDS = 60 * 60 * 24 // 24 h — one replay post per puzzle per user per day
const CONFESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days — one confession per streak milestone

const STREAK_MILESTONES = [7, 14, 30, 50, 100] as const

const isValidGrid = (value: unknown): value is Grid => {
  if (!Array.isArray(value)) return false
  return value.every(
    (row) =>
      Array.isArray(row) &&
      row.every((cell: unknown) => cell === null || cell === 0 || cell === 1)
  )
}

const app = new Hono()

type ShareMode = 'scoreThread' | 'customTopLevel'

type ShareScoreInput = {
  mode: ShareMode
  solveTimeSeconds: number
  difficulty: Difficulty
  dayNumber: number
  solveQuality?: SolveQuality | undefined
  streak?: number | undefined
  rank?: number | undefined
  templateId?: string | undefined
  customText?: string | undefined
}

const SOLVE_QUALITY_VALUES = ['clean', 'sharp', 'comeback', 'assisted']

const shareCommentKey = (
  postId: string,
  puzzleId: string,
  userId: string,
  mode = 'scoreThread'
): string => `share:comment:${postId}:${puzzleId}:${userId}:${mode}`

const isShareMode = (value: string): value is ShareMode =>
  value === 'scoreThread' || value === 'customTopLevel'

const isSolveQuality = (value: string): value is SolveQuality =>
  (SOLVE_QUALITY_VALUES as readonly string[]).includes(value)

const parseOptionalPositiveInteger = (value: unknown): number | undefined => {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined
  }
  return Math.floor(value)
}

const parseShareScoreInput = (raw: unknown): ShareScoreInput | null => {
  if (!raw || typeof raw !== 'object') return null
  const body = raw as Record<string, unknown>
  const modeRaw = typeof body.mode === 'string' ? body.mode : 'scoreThread'
  const solveQuality =
    typeof body.solveQuality === 'string' && isSolveQuality(body.solveQuality)
      ? body.solveQuality
      : undefined

  if (!isShareMode(modeRaw)) return null
  if (typeof body.solveTimeSeconds !== 'number') return null
  if (typeof body.difficulty !== 'string' || !isDifficultyValue(body.difficulty)) return null
  if (typeof body.dayNumber !== 'number' || body.dayNumber < 1) return null

  return {
    mode: modeRaw,
    solveTimeSeconds: body.solveTimeSeconds,
    difficulty: body.difficulty,
    dayNumber: Math.floor(body.dayNumber),
    solveQuality,
    streak: parseOptionalPositiveInteger(body.streak),
    rank: parseOptionalPositiveInteger(body.rank),
    templateId: typeof body.templateId === 'string' ? body.templateId.slice(0, 40) : undefined,
    customText: typeof body.customText === 'string' ? body.customText.slice(0, 280) : undefined,
  }
}

const getShareTargetId = async (
  postId: string,
  mode: ShareMode,
  hasCustomText: boolean
): Promise<`t1_${string}` | `t3_${string}`> => {
  if (mode === 'customTopLevel' && hasCustomText) {
    return ensurePostIdPrefix(postId)
  }
  const scoreThreadId = await redis.get(`post:${postId}:scoreThreadCommentId`)
  if (scoreThreadId?.startsWith('t1_')) {
    return scoreThreadId as `t1_${string}`
  }
  return ensurePostIdPrefix(postId)
}

const shareScore = async (input: ShareScoreInput) => {
  const { postId, userId } = context
  if (!postId) {
    return { ok: false, error: 'postId is required' }
  }
  if (!userId) {
    return { ok: false, error: 'login required' }
  }

  const solveTimeSeconds = Number(input.solveTimeSeconds)
  if (!Number.isFinite(solveTimeSeconds) || solveTimeSeconds < 0) {
    return { ok: false, error: 'invalid solve time' }
  }

  const puzzleId = `${postId}:${input.difficulty}`
  const shareKey = shareCommentKey(postId, puzzleId, userId, input.mode)
  const existingShare = await redis.get(shareKey)

  if (existingShare) {
    return { ok: true }
  }

  const customText = input.customText?.trim()
  if (input.mode === 'customTopLevel' && !customText) {
    return { ok: false, error: 'custom text is required' }
  }

  await redis.set(shareKey, '1')

  const date = todayISO()

  try {
    const targetId = await getShareTargetId(postId, input.mode, Boolean(customText))
    const text = formatScoreShareText({
      dayNumber: input.dayNumber,
      completionTime: solveTimeSeconds,
      difficulty: input.difficulty,
      solveQuality: input.solveQuality,
      streak: input.streak,
      rank: input.rank,
      templateId: input.templateId,
      customText,
    })

    await reddit.submitComment({
      runAs: 'USER',
      id: targetId,
      text,
    })

    // Record share counters after successful Reddit comment (fire-and-forget)
    void Promise.all([
      trackShare(userId, date),
      trackFunnelEvent('share', date),
    ])

    return { ok: true }
  } catch (error) {
    await redis.del(shareKey)

    // Still record the share counter even when the Reddit API call fails (Req 16.1)
    void Promise.all([
      trackShare(userId, date),
      trackFunnelEvent('share', date),
    ])

    const message = error instanceof Error ? error.message : 'Unknown error'
    return { ok: false, error: `Failed to post share comment: ${message}` }
  }
}

app.post('/api/comment-score', async (c) => {
  const body = await c.req
    .json<{ solveTimeSeconds: number; difficulty: Difficulty }>()
    .catch(() => null)
  if (
    !body ||
    typeof body.solveTimeSeconds !== 'number' ||
    typeof body.difficulty !== 'string'
  ) {
    return c.json({ error: 'invalid payload' }, HTTP_BAD_REQUEST)
  }

  const solveTimeSeconds = Number(body.solveTimeSeconds)
  if (!Number.isFinite(solveTimeSeconds) || solveTimeSeconds < 0) {
    return c.json({ error: 'invalid solve time' }, HTTP_BAD_REQUEST)
  }

  if (!isDifficultyValue(body.difficulty)) {
    return c.json({ error: 'invalid difficulty' }, HTTP_BAD_REQUEST)
  }

  const { postId, userId } = context
  if (!postId) {
    return c.json({ error: 'postId is required' }, HTTP_BAD_REQUEST)
  }
  if (!userId) {
    return c.json({ error: 'login required' }, HTTP_BAD_REQUEST)
  }

  try {
    const formattedTime = formatTime(solveTimeSeconds)
    const capitalizedDifficulty =
      body.difficulty.charAt(0).toUpperCase() + body.difficulty.slice(1)
    const commentText = `I solved today's Binary Grid puzzle on ${capitalizedDifficulty} difficulty in ${formattedTime}!`

    await reddit.submitComment({
      runAs: 'USER',
      id: ensurePostIdPrefix(postId),
      text: commentText
    })

    return c.json({ ok: true })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return c.json(
      { error: `Failed to post comment: ${errorMessage}` },
      HTTP_BAD_REQUEST
    )
  }
})

app.post('/api/share-score', async (c) => {
  const input = parseShareScoreInput(await c.req.json().catch(() => null))
  if (!input) {
    return c.json({ ok: false, error: 'invalid payload' }, HTTP_BAD_REQUEST)
  }

  const result = await shareScore(input)
  return c.json(result, result.ok ? HTTP_OK : HTTP_BAD_REQUEST)
})

app.post('/api/share-comment', async (c) => {
  const body = await c.req
    .json<{
      solveTimeSeconds: number
      difficulty: Difficulty
      dayNumber: number
      streak?: number
    }>()
    .catch(() => null)

  if (
    !body ||
    typeof body.solveTimeSeconds !== 'number' ||
    typeof body.difficulty !== 'string' ||
    typeof body.dayNumber !== 'number'
  ) {
    return c.json({ ok: false, error: 'invalid payload' }, HTTP_BAD_REQUEST)
  }

  const solveTimeSeconds = Number(body.solveTimeSeconds)
  if (!Number.isFinite(solveTimeSeconds) || solveTimeSeconds < 0) {
    return c.json({ ok: false, error: 'invalid solve time' }, HTTP_BAD_REQUEST)
  }

  if (!isDifficultyValue(body.difficulty)) {
    return c.json({ ok: false, error: 'invalid difficulty' }, HTTP_BAD_REQUEST)
  }

  const dayNumber = Number(body.dayNumber)
  if (!Number.isFinite(dayNumber) || dayNumber < 1 || !Number.isInteger(dayNumber)) {
    return c.json({ ok: false, error: 'invalid day number' }, HTTP_BAD_REQUEST)
  }

  const result = await shareScore({
    mode: 'scoreThread',
    solveTimeSeconds,
    difficulty: body.difficulty,
    dayNumber,
    streak: body.streak,
  })

  if (!result.ok) {
    return c.json(result, HTTP_BAD_REQUEST)
  }

  return c.json(result)
})

// ── POST /api/post-replay ───────────────────────────────────────────────────
// Submits a new post to the subreddit with the player's emoji grid replay.
// This fixes the "closed-loop share" problem: the result becomes a subreddit
// post visible in the feed, not a buried comment on the game post itself.
app.post('/api/post-replay', async (c) => {
  const { postId, userId, subredditName } = context
  if (!userId) return c.json({ ok: false, error: 'login required' }, HTTP_BAD_REQUEST)
  if (!postId) return c.json({ ok: false, error: 'postId is required' }, HTTP_BAD_REQUEST)
  if (!subredditName) return c.json({ ok: false, error: 'subredditName is required' }, HTTP_BAD_REQUEST)

  const body = await c.req
    .json<{
      grid: unknown
      dayNumber: number
      solveTimeSeconds: number
      difficulty: string
      solveQuality?: string
      streak?: number
      rank?: number
      fasterThanPercentile?: number
    }>()
    .catch(() => null)

  if (!body) return c.json({ ok: false, error: 'invalid payload' }, HTTP_BAD_REQUEST)
  if (!isValidGrid(body.grid)) return c.json({ ok: false, error: 'invalid grid' }, HTTP_BAD_REQUEST)
  if (typeof body.dayNumber !== 'number' || body.dayNumber < 1) return c.json({ ok: false, error: 'invalid dayNumber' }, HTTP_BAD_REQUEST)
  if (typeof body.solveTimeSeconds !== 'number' || !Number.isFinite(body.solveTimeSeconds) || body.solveTimeSeconds < 0) {
    return c.json({ ok: false, error: 'invalid solveTimeSeconds' }, HTTP_BAD_REQUEST)
  }
  if (!isDifficultyValue(body.difficulty)) return c.json({ ok: false, error: 'invalid difficulty' }, HTTP_BAD_REQUEST)

  // Idempotency: one replay post per user per puzzle per day
  const puzzleId = `${postId}:${body.difficulty}`
  const replayKey = `share:replay:${userId}:${puzzleId}`
  const alreadyPosted = await redis.get(replayKey)
  if (alreadyPosted) return c.json({ ok: true, alreadyPosted: true })

  const difficulty = body.difficulty as Difficulty
  const solveQuality = (
    body.solveQuality && ['clean', 'sharp', 'comeback', 'assisted'].includes(body.solveQuality)
      ? body.solveQuality
      : undefined
  ) as SolveQuality | undefined

  const title = formatReplayPostTitle({
    dayNumber: body.dayNumber,
    completionTime: body.solveTimeSeconds,
    difficulty,
  })

  const text = formatReplayPostText({
    grid: body.grid as Grid,
    dayNumber: body.dayNumber,
    completionTime: body.solveTimeSeconds,
    difficulty,
    solveQuality,
    streak: typeof body.streak === 'number' ? body.streak : undefined,
    rank: typeof body.rank === 'number' ? body.rank : undefined,
    fasterThanPercentile: typeof body.fasterThanPercentile === 'number' ? body.fasterThanPercentile : undefined,
  })

  // Mark idempotency key before API call (optimistic lock; delete on failure)
  await redis.set(replayKey, '1')
  await redis.expire(replayKey, SHARE_POST_TTL_SECONDS)

  try {
    await reddit.submitComment({
      runAs: 'USER',
      id: ensurePostIdPrefix(postId),
      text: `**${title}**\n\n${text}`,
    })

    void Promise.all([
      trackShare(userId, todayISO()),
      trackFunnelEvent('share', todayISO()),
    ])

    return c.json({ ok: true })
  } catch (error) {
    // Rollback idempotency key so user can retry
    await redis.del(replayKey)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ ok: false, error: `Failed to post replay: ${message}` }, HTTP_BAD_REQUEST)
  }
})

// ── POST /api/streak-confession ─────────────────────────────────────────────
// Opt-in: posts a self-aware streak milestone post to r/binarygrid.
// Only fires at defined milestones (7, 14, 30, 50, 100).
// One confession per milestone per user — idempotent.
app.post('/api/streak-confession', async (c) => {
  const { userId } = context
  if (!userId) return c.json({ ok: false, error: 'login required' }, HTTP_BAD_REQUEST)

  const body = await c.req.json<{ streak: number }>().catch(() => null)
  if (!body || typeof body.streak !== 'number' || body.streak < 1) {
    return c.json({ ok: false, error: 'invalid streak' }, HTTP_BAD_REQUEST)
  }

  const milestone = (STREAK_MILESTONES as readonly number[]).includes(body.streak)
    ? body.streak
    : null
  if (milestone === null) {
    return c.json({ ok: false, error: 'not a confession milestone' }, HTTP_BAD_REQUEST)
  }

  const { postId, subredditName } = context
  if (!postId) return c.json({ ok: false, error: 'postId is required' }, HTTP_BAD_REQUEST)
  if (!subredditName) return c.json({ ok: false, error: 'subredditName is required' }, HTTP_BAD_REQUEST)

  // Idempotency: one confession per user per milestone
  const confessionKey = `confession:${userId}:${milestone}`
  const alreadyPosted = await redis.get(confessionKey)
  if (alreadyPosted) return c.json({ ok: true, alreadyPosted: true })

  // Resolve username
  const metaRaw = await redis.hGet('user:meta', userId)
  const username = metaRaw
    ? ((JSON.parse(metaRaw) as { username?: string }).username ?? 'Redditor')
    : 'Redditor'

  const text = formatStreakConfessionText({ streak: milestone, username })

  await redis.set(confessionKey, '1')
  await redis.expire(confessionKey, CONFESSION_TTL_SECONDS)

  try {
    // Post as a comment on the current game post (surfaced as engagement)
    await reddit.submitComment({
      runAs: 'USER',
      id: ensurePostIdPrefix(postId),
      text,
    })

    void trackShare(userId, todayISO())

    return c.json({ ok: true })
  } catch (error) {
    await redis.del(confessionKey)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ ok: false, error: `Failed to post confession: ${message}` }, HTTP_BAD_REQUEST)
  }
})

export default app
