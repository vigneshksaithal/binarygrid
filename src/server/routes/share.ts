import { context, reddit, redis } from '@devvit/web/server'
import { Hono } from 'hono'
import type { SolveQuality } from '../../shared/growth'
import type { Difficulty } from '../../shared/types/puzzle'
import { formatScoreShareText } from '../../shared/share-formatter'
import { formatTime } from '../../shared/utils/format'
import { trackFunnelEvent, trackShare } from '../lib/viral-analytics'
import {
  ensurePostIdPrefix,
  HTTP_BAD_REQUEST,
  HTTP_OK,
  isDifficultyValue,
  todayISO
} from './utils'

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

export default app
