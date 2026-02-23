import { context, redis } from '@devvit/web/server'
import { Hono } from 'hono'
import type { LeaderboardEntry, LeaderboardResponse } from '../../shared/types/leaderboard'
import type { StreakLeaderboardEntry } from '../../shared/types/streak'
import {
  clampPageSize,
  DECIMAL_RADIX,
  HTTP_BAD_REQUEST,
  leaderboardKey,
  leaderboardMetaKey,
  LEADERBOARD_DEFAULT_PAGE_SIZE,
  parseLeaderboardMeta
} from './utils'

const app = new Hono()

app.get('/api/leaderboard', async (c) => {
  const queryPuzzleId = c.req.query('puzzleId') ?? ''
  if (!queryPuzzleId) {
    return c.json({ error: 'puzzleId is required' }, HTTP_BAD_REQUEST)
  }

  const pageParam = Number.parseInt(c.req.query('page') ?? '0', DECIMAL_RADIX)
  const page = Number.isNaN(pageParam) || pageParam < 0 ? 0 : pageParam
  const requestedPageSize = Number.parseInt(
    c.req.query('pageSize') ?? `${LEADERBOARD_DEFAULT_PAGE_SIZE}`,
    DECIMAL_RADIX
  )
  const pageSize = clampPageSize(requestedPageSize)
  const offset = page * pageSize

  const leaderboardSetKey = leaderboardKey(queryPuzzleId)
  const leaderboardDetailsKey = leaderboardMetaKey(queryPuzzleId)

  try {
    const totalEntries = await redis.zCard(leaderboardSetKey)
    if (totalEntries === 0) {
      const emptyResponse: LeaderboardResponse = {
        entries: [],
        totalEntries,
        page,
        pageSize,
        hasNextPage: false,
        hasPreviousPage: false,
        playerEntry: null
      }
      return c.json(emptyResponse)
    }

    const rangeMembers = await redis.zRange(
      leaderboardSetKey,
      offset,
      offset + pageSize - 1,
      { by: 'rank' }
    )

    const metaValues =
      rangeMembers.length > 0
        ? await redis.hMGet(
          leaderboardDetailsKey,
          rangeMembers.map((entry) => entry.member)
        )
        : []

    const entries: LeaderboardEntry[] = rangeMembers.map((entry, index) => {
      const rawMeta = metaValues[index]
      const parsedMeta = parseLeaderboardMeta(
        rawMeta !== null ? rawMeta : undefined
      )

      return {
        userId: entry.member,
        username: parsedMeta.username,
        avatarUrl: parsedMeta.avatarUrl,
        timeSeconds: entry.score,
        rank: offset + index + 1,
        attempts: parsedMeta.attempts
      }
    })

    const { userId } = context
    let playerEntry: LeaderboardEntry | null = null
    if (userId) {
      const [playerRank, playerScore, playerMetaRaw] = await Promise.all([
        redis.zRank(leaderboardSetKey, userId),
        redis.zScore(leaderboardSetKey, userId),
        redis.hGet(leaderboardDetailsKey, userId)
      ])

      if (
        playerRank !== undefined &&
        playerRank !== null &&
        playerScore !== undefined &&
        playerScore !== null
      ) {
        const playerMeta = parseLeaderboardMeta(playerMetaRaw)
        playerEntry = {
          userId,
          username: playerMeta.username,
          avatarUrl: playerMeta.avatarUrl,
          timeSeconds: playerScore,
          rank: playerRank + 1,
          attempts: playerMeta.attempts
        }
      }
    }

    const response: LeaderboardResponse = {
      entries,
      totalEntries,
      page,
      pageSize,
      hasNextPage: offset + pageSize < totalEntries,
      hasPreviousPage: page > 0,
      playerEntry
    }

    return c.json(response)
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return c.json(
      { error: `Failed to load leaderboard: ${errorMessage}` },
      HTTP_BAD_REQUEST
    )
  }
})

type UserMeta = { username: string; avatarUrl: string | null }

const getUserMeta = async (userId: string): Promise<UserMeta> => {
  const metaRaw = await redis.hGet('user:meta', userId)
  if (metaRaw) {
    try {
      const parsed = JSON.parse(metaRaw)
      if (parsed.username) {
        return { username: parsed.username, avatarUrl: parsed.avatarUrl ?? null }
      }
    } catch { /* fallthrough */ }
  }
  const legacyMeta = await redis.hGetAll(`user:${userId}:meta`)
  if (legacyMeta?.username) {
    return { username: legacyMeta.username, avatarUrl: legacyMeta.avatarUrl ?? null }
  }
  return { username: 'Unknown player', avatarUrl: null }
}

app.get('/api/leaderboard/streaks', async (c) => {
  const { userId } = context

  try {
    const totalEntries = await redis.zCard('leaderboard:streaks')

    if (totalEntries === 0) {
      return c.json({
        entries: [],
        totalEntries,
        playerEntry: null
      })
    }

    const rangeMembers = await redis.zRange(
      'leaderboard:streaks',
      0,
      9,
      { by: 'rank', reverse: true }
    )

    const userMetaResults = await Promise.all(
      rangeMembers.map((entry) => getUserMeta(entry.member))
    )

    const entries: StreakLeaderboardEntry[] = rangeMembers.map((entry, index) => {
      const meta = userMetaResults[index]!
      return {
        userId: entry.member,
        username: meta.username,
        avatarUrl: meta.avatarUrl,
        streak: entry.score,
        rank: index + 1
      }
    })

    let playerEntry: StreakLeaderboardEntry | null = null
    if (userId) {
      const [playerRank, playerScore] = await Promise.all([
        redis.zRank('leaderboard:streaks', userId),
        redis.zScore('leaderboard:streaks', userId)
      ])

      if (playerRank !== undefined && playerRank !== null && playerScore !== undefined && playerScore !== null) {
        const playerMeta = await getUserMeta(userId)
        playerEntry = {
          userId,
          username: playerMeta.username,
          avatarUrl: playerMeta.avatarUrl,
          streak: playerScore,
          rank: totalEntries - playerRank
        }
      }
    }

    return c.json({
      entries,
      totalEntries,
      playerEntry
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return c.json(
      { error: `Failed to load streak leaderboard: ${errorMessage}` },
      HTTP_BAD_REQUEST
    )
  }
})

export default app
