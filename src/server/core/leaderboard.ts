import { redis } from '@devvit/web/server'

const COMPOSITE_SCORE_FACTOR = 1_000_000_000

/**
 * Calculates a composite score for the leaderboard.
 *
 * @param rawScore The user's raw score.
 * @param achievedAt The epoch seconds when the score was achieved.
 * @returns The composite score.
 */
export const calculateCompositeScore = (
  rawScore: number,
  achievedAt: number
): number => {
  return rawScore * COMPOSITE_SCORE_FACTOR - achievedAt
}

/**
 * Submits a score to the leaderboard.
 *
 * @param postId The ID of the post.
 * @param userId The ID of the user.
 * @param username The username of the user.
 * @param rawScore The user's raw score.
 * @param achievedAt The epoch seconds when the score was achieved.
 * @returns An object containing the user's rank, best raw score, and whether the score was an improvement.
 */
export const submitScore = async (
  postId: string,
  userId: string,
  username: string,
  rawScore: number,
  achievedAt: number
): Promise<{
  rank: number
  bestRawScore: number
  improved: boolean
}> => {
  const leaderboardKey = `lb:${postId}:z`
  const userKey = `user:${userId}`
  const userMetaKey = `lb:${postId}:u:${userId}`

  const existingRawScoreStr = await redis.hGet(userMetaKey, 'rawScore')
  const existingRawScore = existingRawScoreStr
    ? Number.parseInt(existingRawScoreStr, 10)
    : null

  if (existingRawScore !== null && rawScore <= existingRawScore) {
    const rank = (await redis.zRevRank(leaderboardKey, userKey)) ?? -1
    return {
      rank,
      bestRawScore: existingRawScore,
      improved: false
    }
  }

  const compositeScore = calculateCompositeScore(rawScore, achievedAt)
  const tx = redis.multi()
  tx.zAdd(leaderboardKey, {
    member: userKey,
    score: compositeScore
  })
  tx.hSet(userMetaKey, { username, rawScore: rawScore.toString() })

  const LEADERBOARD_TTL_DAYS = 30
  const ttlSeconds = LEADERBOARD_TTL_DAYS * 24 * 60 * 60

  tx.expire(leaderboardKey, ttlSeconds)
  tx.expire(userMetaKey, ttlSeconds)

  await tx.exec()

  const rank = (await redis.zRevRank(leaderboardKey, userKey)) ?? -1
  return { rank, bestRawScore: rawScore, improved: true }
}
