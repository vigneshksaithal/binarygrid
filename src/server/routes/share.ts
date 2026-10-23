import { context, reddit, redis } from '@devvit/web/server'
import { Hono } from 'hono'
import {
  formatScoreShareText,
  getShareMode,
  SHARE_LOGIN_REQUIRED_ERROR,
  type ScoreShareRequest,
  type ShareMode,
} from '../../shared/share-formatter'
import { parseScoreShareRequest } from '../../shared/validator'
import { ensureScoreThread } from '../core/post'
import { trackFunnelEvent, trackShare } from '../lib/viral-analytics'
import {
  ensurePostIdPrefix,
  HTTP_BAD_REQUEST,
  HTTP_OK,
  todayISO
} from './utils'

const app = new Hono()

type ShareResult = { ok: true } | { ok: false; error: string }

const INVALID_PAYLOAD: ShareResult = { ok: false, error: 'invalid payload' }

const shareCommentKey = (
  postId: string,
  puzzleId: string,
  userId: string,
  mode: ShareMode
): string => `share:comment:${postId}:${puzzleId}:${userId}:${mode}`

const isCommentId = (id: string | null): id is `t1_${string}` =>
  id?.startsWith('t1_') ?? false

// Devvit Rules: a generic score must reply under the sticky score thread; only a
// comment with the player's own words may go top-level. Never fall back to the post.
const getShareTargetId = async (
  postId: string,
  mode: ShareMode
): Promise<`t1_${string}` | `t3_${string}`> => {
  if (mode === 'customTopLevel') return ensurePostIdPrefix(postId)

  const scoreThreadId = await ensureScoreThread(postId)
  if (!isCommentId(scoreThreadId)) {
    throw new Error("today's score thread is unavailable")
  }
  return scoreThreadId
}

// Counts failed attempts too, until shares are counted once (B-04, Next)
const recordShareAttempt = (userId: string): void => {
  const date = todayISO()
  void Promise.all([
    trackShare(userId, date),
    trackFunnelEvent('share', date),
  ])
}

const shareScore = async (request: ScoreShareRequest): Promise<ShareResult> => {
  const { postId, userId } = context
  if (!postId) {
    return { ok: false, error: 'postId is required' }
  }
  if (!userId) {
    return { ok: false, error: SHARE_LOGIN_REQUIRED_ERROR }
  }

  const mode = getShareMode(request)
  const puzzleId = `${postId}:${request.difficulty}`
  const shareKey = shareCommentKey(postId, puzzleId, userId, mode)

  if (await redis.get(shareKey)) {
    return { ok: true }
  }

  await redis.set(shareKey, '1')

  try {
    await reddit.submitComment({
      runAs: 'USER',
      id: await getShareTargetId(postId, mode),
      text: formatScoreShareText(request),
    })
    recordShareAttempt(userId)
    return { ok: true }
  } catch (error) {
    // Release the key so the player can retry
    await redis.del(shareKey)
    recordShareAttempt(userId)

    const message = error instanceof Error ? error.message : 'Unknown error'
    return { ok: false, error: `Failed to post share comment: ${message}` }
  }
}

app.post('/api/share-score', async (c) => {
  const request = parseScoreShareRequest(await c.req.json().catch(() => null))
  if (!request) {
    return c.json(INVALID_PAYLOAD, HTTP_BAD_REQUEST)
  }

  const result = await shareScore(request)
  return c.json(result, result.ok ? HTTP_OK : HTTP_BAD_REQUEST)
})

export default app
