/**
 * preview.ts — Live feed preview card for Binary Grid.
 *
 * Builds the HTML passed to setCustomPostPreview so every Reddit feed scroll
 * shows a live thumbnail with: top-3 times and a spoiler-free emoji preview
 * of today's grid.
 *
 * Constraints:
 *  - No external image fetches (Devvit sandboxed preview)
 *  - No JavaScript — pure HTML/inline CSS
 *  - Keep under 50 KB
 */

import { reddit, redis } from '@devvit/web/server'
import type { Difficulty } from '../../shared/types/puzzle'
import { formatTime } from '../../shared/utils/format'

const PREVIEW_ACTIVE_POST_KEY = 'active:postId:current'
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

// ── Redis helpers ────────────────────────────────────────────────────────────

type LeaderboardEntry = { member: string; score: number }
type TopSolverRow = { rank: number; username: string; timeSeconds: number }

const getTop3Solvers = async (postId: string): Promise<TopSolverRow[]> => {
  const results: TopSolverRow[] = []
  for (const difficulty of DIFFICULTIES) {
    const puzzleId = `${postId}:${difficulty}`
    const leaderboardKey = `leaderboard:${puzzleId}`
    const metaKey = `leaderboard:${puzzleId}:meta`

    try {
      const top = (await redis.zRange(leaderboardKey, 0, 0, { by: 'rank' })) as LeaderboardEntry[]
      if (!top || top.length === 0) continue

      const entry = top[0]
      if (!entry) continue

      const metaRaw = await redis.hGet(metaKey, entry.member)
      let username = 'player'
      if (metaRaw) {
        try {
          const parsed = JSON.parse(metaRaw) as { username?: string }
          username = parsed.username ?? 'player'
        } catch {
          // use default
        }
      }

      results.push({ rank: 1, username, timeSeconds: Math.round(entry.score) })
      if (results.length >= 3) break
    } catch {
      // skip this difficulty
    }
  }
  return results
}

// ── HTML builder ─────────────────────────────────────────────────────────────

const medal = (rank: number) =>
  rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'

export const buildPreviewHtml = (opts: {
  topSolvers: TopSolverRow[]
  puzzleNumber: number | null
}): string => {
  const { topSolvers } = opts

  const solverRows = topSolvers
    .map(
      (s, i) =>
        `<div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span>${medal(i + 1)} ${escapeHtml(s.username)}</span>
          <span style="color:#4ade80;font-weight:700">${formatTime(s.timeSeconds)}</span>
        </div>`
    )
    .join('')

  const solverSection =
    topSolvers.length > 0
      ? `<div style="margin-top:10px;font-size:13px">${solverRows}</div>`
      : `<div style="margin-top:10px;font-size:13px;color:#71717a">No solvers yet — be first!</div>`

  const puzzleLabel = opts.puzzleNumber !== null ? `Binary Grid #${opts.puzzleNumber}` : 'Binary Grid'

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#18181b;color:#f4f4f5;font-family:system-ui,sans-serif">
  <div style="padding:16px;max-width:480px">

    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <span style="font-size:22px">🧩</span>
      <span style="font-size:17px;font-weight:700;color:#4ade80">${escapeHtml(puzzleLabel)}</span>
    </div>

    <div style="border-top:1px solid #27272a;padding-top:10px">
      <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Today's best</div>
      ${solverSection}
    </div>

    <div style="margin-top:12px;font-size:11px;color:#52525b;border-top:1px solid #27272a;padding-top:8px">
      Daily logic puzzle · 3 difficulties · free to play
    </div>
  </div>
</body>
</html>`
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// ── Public: refresh the live preview on the current active post ──────────────

export const refreshPostPreview = async (): Promise<{ ok: boolean; reason?: string }> => {
  // Resolve the current active post
  const storedPostId = await redis.get(PREVIEW_ACTIVE_POST_KEY)
  if (!storedPostId) {
    return { ok: false, reason: 'no active postId stored' }
  }

  const topSolvers = await getTop3Solvers(storedPostId)

  // Resolve puzzle number (day number) for the post title
  let puzzleNumber: number | null = null
  try {
    const numberRaw = await redis.get(`post:${storedPostId}:puzzleNumber`)
    if (numberRaw) puzzleNumber = Number.parseInt(numberRaw, 10)
  } catch {
    // non-fatal
  }

  const html = buildPreviewHtml({ topSolvers, puzzleNumber })

  // setCustomPostPreview is available on the post object via the Reddit API
  try {
    const postIdWithPrefix = storedPostId.startsWith('t3_')
      ? (storedPostId as `t3_${string}`)
      : (`t3_${storedPostId}` as `t3_${string}`)
    const post = await reddit.getPostById(postIdWithPrefix)
    if (!post) return { ok: false, reason: 'post not found' }
    // setCustomPostPreview is available on Devvit post objects
    await (post as unknown as { setCustomPostPreview: (html: string) => Promise<void> }).setCustomPostPreview(html)
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { ok: false, reason: `setCustomPostPreview failed: ${message}` }
  }
}

/**
 * Records the given postId as the current active post and immediately
 * sets its preview. Called from createPost() after each daily post.
 */
export const setActivePostAndRefreshPreview = async (postId: string): Promise<void> => {
  // Store active post — strip t3_ prefix for consistency with rest of codebase
  const bareId = postId.startsWith('t3_') ? postId.slice(3) : postId
  await redis.set(PREVIEW_ACTIVE_POST_KEY, bareId)
  // Best-effort initial preview — non-fatal
  try {
    await refreshPostPreview()
  } catch {
    // ignore
  }
}
