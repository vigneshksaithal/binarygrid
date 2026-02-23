import { context, reddit, redis } from '@devvit/web/server'
import { Hono } from 'hono'
import type { Difficulty } from '../../shared/types/puzzle'
import { formatSimpleShareText } from '../../shared/share-formatter'
import { formatTime } from '../../shared/utils/format'
import {
  ensurePostIdPrefix,
  HTTP_BAD_REQUEST,
  isDifficultyValue
} from './utils'

const app = new Hono()

const shareCommentKey = (postId: string, puzzleId: string, userId: string): string =>
  `share:comment:${postId}:${puzzleId}:${userId}`

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

  const { postId, userId } = context
  if (!postId) {
    return c.json({ ok: false, error: 'postId is required' }, HTTP_BAD_REQUEST)
  }
  if (!userId) {
    return c.json({ ok: false, error: 'login required' }, HTTP_BAD_REQUEST)
  }

  const puzzleId = `${postId}:${body.difficulty}`

  try {
    const shareKey = shareCommentKey(postId, puzzleId, userId)
    const existingShare = await redis.get(shareKey)

    if (existingShare) {
      return c.json({ ok: true })
    }

    await redis.set(shareKey, '1')

    const commentText = formatSimpleShareText({
      dayNumber,
      completionTime: solveTimeSeconds,
      difficulty: body.difficulty,
      streak: body.streak ?? undefined
    })

    try {
      await reddit.submitComment({
        runAs: 'USER',
        id: ensurePostIdPrefix(postId),
        text: commentText
      })
    } catch (redditError) {
      await redis.del(shareKey)
      throw redditError
    }

    return c.json({ ok: true })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return c.json(
      { ok: false, error: `Failed to post share comment: ${errorMessage}` },
      HTTP_BAD_REQUEST
    )
  }
})

export default app
