import { redis } from '@devvit/web/server'
import type { ActivePlayerSummary, RecentSolver, SocialProofData } from '../../shared/viral-types'
import { todayISO } from '../routes/utils'

// TTL constants
const ACTIVE_PLAYERS_TTL_SECONDS = 60 * 60 * 24 // 24 hours
const FIVE_MINUTES_MS = 5 * 60 * 1000

// Redis key helpers
const activeKey = (postId: string) => `social:active:${postId}`
const solveCountKey = (date: string) => `social:solvecount:${date}`

// Type cast helper for zRemRangeByScore (not in the mock type)
const zRemRangeByScore = (key: string, min: number, max: number): Promise<number> =>
    (redis as unknown as { zRemRangeByScore: (key: string, min: number, max: number) => Promise<number> })
        .zRemRangeByScore(key, min, max)

/**
 * Resolves avatar metadata for a userId from the `user:meta` hash.
 * Falls back to `{ username: 'Player', avatarUrl: null }` when missing.
 *
 * Requirements: 10.6
 */
const resolveAvatar = async (
    userId: string
): Promise<{ userId: string; username: string; avatarUrl: string | null }> => {
    const metaRaw = await redis.hGet('user:meta', userId)
    const meta = metaRaw
        ? (JSON.parse(metaRaw) as { username: string; avatarUrl: string | null })
        : { username: 'Player', avatarUrl: null }
    return { userId, username: meta.username, avatarUrl: meta.avatarUrl }
}

/**
 * Reads the current solved-today count from `social:solvecount:{date}`.
 * Returns 0 when the key is absent.
 *
 * Requirements: 10.2
 */
const getSolvedTodayCount = async (): Promise<number> => {
    const raw = await redis.get(solveCountKey(todayISO()))
    return Number.parseInt(raw ?? '0', 10)
}

/**
 * Records a heartbeat for the given user on the given post.
 *
 * - Adds/updates the user's entry in `social:active:{postId}` with the
 *   current Unix timestamp (ms) as the score.
 * - Prunes entries older than 5 minutes via `ZREMRANGEBYSCORE`.
 * - Sets a 24-hour TTL on the key for automatic cleanup.
 * - Returns an `ActivePlayerSummary` with the current active count, up to 5
 *   most-recent avatars, and today's solve count.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.6
 */
export const recordHeartbeat = async (
    postId: string,
    userId: string
): Promise<ActivePlayerSummary> => {
    const now = Date.now()
    const fiveMinutesAgo = now - FIVE_MINUTES_MS
    const key = activeKey(postId)

    // Add/update user's timestamp
    await redis.zAdd(key, { member: userId, score: now })

    // Prune stale entries (older than 5 minutes)
    await zRemRangeByScore(key, 0, fiveMinutesAgo)

    // Set TTL for auto-cleanup
    await redis.expire(key, ACTIVE_PLAYERS_TTL_SECONDS)

    // Get active count after pruning
    const count = await redis.zCard(key)

    // Get the 5 most-recently active members (highest scores = most recent)
    const recentMembers = await redis.zRange(key, 0, 4, { by: 'rank', reverse: true })

    const recentAvatars = await Promise.all(
        recentMembers.map((entry) => resolveAvatar(entry.member))
    )

    const solvedTodayCount = await getSolvedTodayCount()

    return { count, recentAvatars, solvedTodayCount }
}

/**
 * Returns the current active player summary for the given post without
 * recording a new heartbeat.
 *
 * - Prunes stale entries (older than 5 minutes) before reading.
 * - Returns count, up to 5 most-recent avatars, and today's solve count.
 *
 * Requirements: 9.2, 9.3, 9.4, 10.1, 10.6
 */
export const getActivePlayers = async (postId: string): Promise<ActivePlayerSummary> => {
    const now = Date.now()
    const fiveMinutesAgo = now - FIVE_MINUTES_MS
    const key = activeKey(postId)

    // Prune stale entries before reading
    await zRemRangeByScore(key, 0, fiveMinutesAgo)

    // Get active count after pruning
    const count = await redis.zCard(key)

    // Get the 5 most-recently active members
    const recentMembers = await redis.zRange(key, 0, 4, { by: 'rank', reverse: true })

    const recentAvatars = await Promise.all(
        recentMembers.map((entry) => resolveAvatar(entry.member))
    )

    const solvedTodayCount = await getSolvedTodayCount()

    return { count, recentAvatars, solvedTodayCount }
}

// Type cast helpers for Redis methods not in the mock type
const zRemRangeByRank = (key: string, start: number, stop: number): Promise<number> =>
    (redis as unknown as { zRemRangeByRank: (key: string, start: number, stop: number) => Promise<number> })
        .zRemRangeByRank(key, start, stop)

const lRange = (key: string, start: number, stop: number): Promise<string[]> =>
    (redis as unknown as { lRange: (key: string, start: number, stop: number) => Promise<string[]> })
        .lRange(key, start, stop)

/**
 * Records a puzzle solve for the given user.
 *
 * - Increments `social:solvecount:{date}` with a 48-hour TTL.
 * - Adds the userId to `social:solvers:{puzzleId}` ZSET with the current
 *   Unix timestamp as the score.
 * - Trims the ZSET to the last 10 entries via ZREMRANGEBYRANK.
 *
 * Requirements: 10.3, 10.4, 17.1, 19.5
 */
export const recordSolve = async (
    userId: string,
    puzzleId: string,
    _solveTime: number
): Promise<void> => {
    const today = todayISO()

    // Increment today's solve count with 48h TTL
    await redis.incrBy(`social:solvecount:${today}`, 1)
    await redis.expire(`social:solvecount:${today}`, 60 * 60 * 48)

    // Add to recent solvers ZSET with current timestamp as score
    const now = Date.now()
    await redis.zAdd(`social:solvers:${puzzleId}`, { member: userId, score: now })

    // Keep only last 10 entries (remove lowest-score entries, i.e. oldest)
    await zRemRangeByRank(`social:solvers:${puzzleId}`, 0, -11)
}

/**
 * Returns the most recent solvers for a puzzle, resolved with usernames.
 *
 * - Reads the `social:solvers:{puzzleId}` ZSET in reverse order (most recent first).
 * - Resolves each userId to a username via `user:meta`.
 * - Falls back to `{ username: 'Player', avatarUrl: null }` when metadata is missing.
 *
 * Requirements: 10.1, 10.6
 */
export const getRecentSolvers = async (
    puzzleId: string,
    limit: number
): Promise<RecentSolver[]> => {
    // Get most recent solvers (highest scores = most recent timestamps)
    const members = await redis.zRange(`social:solvers:${puzzleId}`, 0, limit - 1, {
        by: 'rank',
        reverse: true,
    })

    return Promise.all(
        members.map(async (entry) => {
            const metaRaw = await redis.hGet('user:meta', entry.member)
            const meta = metaRaw
                ? (JSON.parse(metaRaw) as { username: string; avatarUrl: string | null })
                : { username: 'Player', avatarUrl: null }
            return {
                userId: entry.member,
                username: meta.username,
                avatarUrl: meta.avatarUrl,
                solveTime: 0, // not stored in ZSET
                solvedAt: new Date(entry.score).toISOString(),
            }
        })
    )
}

/**
 * Aggregates social proof data for a post.
 *
 * - Active player count and today's solve count come from `getActivePlayers`.
 * - Recent solvers (up to 5) come from `getRecentSolvers`.
 * - Pending challenge count is read from `user:{userId}:challenges:pending`
 *   when a userId is provided; defaults to 0 for unauthenticated users.
 *
 * Requirements: 10.2, 10.5, 17.1, 17.3, 17.4
 */
export const getSocialProof = async (
    postId: string,
    userId?: string
): Promise<SocialProofData> => {
    const activeSummary = await getActivePlayers(postId)
    const recentSolvers = await getRecentSolvers(postId, 5)

    let pendingChallenges = 0
    if (userId) {
        const pendingList = await lRange(`user:${userId}:challenges:pending`, 0, -1)
        pendingChallenges = pendingList.length
    }

    return {
        activePlayers: activeSummary.count,
        solvedToday: activeSummary.solvedTodayCount,
        recentSolvers,
        pendingChallenges,
    }
}
