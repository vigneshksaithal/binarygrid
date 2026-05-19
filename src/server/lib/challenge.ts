import { redis } from '@devvit/web/server'
import { determineWinner, isValidTransition, validateUsername } from '../../shared/challenge-logic'
import type { Challenge, ChallengeResult, ChallengeState } from '../../shared/viral-types'
import { todayISO } from '../routes/utils'

// TTL constants
const CHALLENGE_PENDING_TTL_SECONDS = 60 * 60       // 1 hour
const CHALLENGE_ACTIVE_TTL_SECONDS = 60 * 30        // 30 minutes
const CHALLENGES_SENT_TTL_SECONDS = 60 * 60 * 24 * 60 // 60 days
const CHALLENGES_COMPLETED_TTL_SECONDS = 60 * 60 * 24 * 60 // 60 days
const RATE_LIMIT_TTL_SECONDS = 60 * 60              // 1 hour
const MAX_PENDING_PER_HOUR = 5
const CHALLENGE_HISTORY_MAX_ENTRIES = 20

// Redis key helpers
const challengeKey = (challengeId: string) => `challenge:${challengeId}`
const pendingInboxKey = (userId: string) => `user:${userId}:challenges:pending`
const historyKey = (userId: string) => `user:${userId}:challenges:history`
const activePairKey = (pairKey: string) => `challenge:active:${pairKey}`
const rateLimitKey = (userId: string, hourKey: string) =>
    `user:${userId}:challenges:sent-count:${hourKey}`
const challengesSentKey = (date: string) => `viral:daily:${date}:challenges_sent`
const challengesCompletedKey = (date: string) => `viral:daily:${date}:challenges_completed`

/**
 * Parses a raw Redis hash into a typed Challenge object.
 * Numeric fields are parsed from their stored string representations.
 */
export const parseChallengeHash = (
    hash: Record<string, string | undefined>,
    id: string
): Challenge => {
    const base: Challenge = {
        id,
        state: (hash.state ?? 'expired') as ChallengeState,
        challengerId: hash.challengerId ?? '',
        opponentId: hash.opponentId ?? '',
        challengerUsername: hash.challengerUsername ?? '',
        opponentUsername: hash.opponentUsername ?? '',
        puzzleId: hash.puzzleId ?? '',
        createdAt: hash.createdAt ?? '',
    }
    if (hash.startedAt !== undefined) base.startedAt = hash.startedAt
    if (hash.challengerTime !== undefined) base.challengerTime = Number.parseFloat(hash.challengerTime)
    if (hash.opponentTime !== undefined) base.opponentTime = Number.parseFloat(hash.opponentTime)
    if (hash.winner !== undefined) base.winner = hash.winner
    if (hash.margin !== undefined) base.margin = Number.parseFloat(hash.margin)
    return base
}

/**
 * Resolves a userId from a Reddit username by scanning the `user:meta` hash.
 * Returns the userId (key) whose stored JSON has `username === opponentUsername`,
 * or null if not found.
 *
 * Requirements: 12.8
 */
export const resolveOpponentId = async (username: string): Promise<string | null> => {
    const allMeta = await redis.hGetAll('user:meta')
    for (const [userId, metaRaw] of Object.entries(allMeta)) {
        try {
            const meta = JSON.parse(metaRaw) as { username: string; avatarUrl: string | null }
            if (meta.username === username) return userId
        } catch {
            // Skip malformed entries
        }
    }
    return null
}

/**
 * Returns the current hour key (YYYY-MM-DDTHH) for rate limiting.
 */
const currentHourKey = (): string => new Date().toISOString().slice(0, 13)

/**
 * Creates a new 1v1 challenge between the challenger and the named opponent.
 *
 * Enforces:
 * - Opponent must exist in `user:meta` (12.8)
 * - Self-challenge rejection (12.6)
 * - Active-pair deduplication (12.7)
 * - Rate limit: max 5 pending challenges per hour (12.9)
 *
 * On success:
 * - Creates challenge hash with 1-hour TTL (12.1, 12.2)
 * - Pushes challengeId to opponent's pending inbox with 1-hour TTL (12.3)
 * - Sets dedup lock with 1-hour TTL (12.4)
 * - Increments `viral:daily:{date}:challenges_sent` (12.5)
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9
 */
export const createChallenge = async (
    challengerId: string,
    opponentUsername: string,
    puzzleId: string
): Promise<Challenge> => {
    if (!validateUsername(opponentUsername)) {
        throw new Error('Invalid username format')
    }

    // Resolve opponent userId from username (12.8)
    const opponentId = await resolveOpponentId(opponentUsername)
    if (!opponentId) {
        throw new Error('User not found. They need to play at least one puzzle first.')
    }

    // Self-challenge rejection (12.6)
    if (opponentId === challengerId) {
        throw new Error('Cannot challenge yourself')
    }

    // Active-pair deduplication (12.7)
    const pairKey = [challengerId, opponentId].sort().join(':')
    const existingId = await redis.get(activePairKey(pairKey))
    if (existingId) {
        throw new Error('Active challenge already exists between these players')
    }

    // Rate limit: max 5 pending challenges per hour (12.9)
    const hourKey = currentHourKey()
    const rateKey = rateLimitKey(challengerId, hourKey)
    const sentCount = await redis.incrBy(rateKey, 1)
    await redis.expire(rateKey, RATE_LIMIT_TTL_SECONDS)
    if (sentCount > MAX_PENDING_PER_HOUR) {
        throw new Error('Rate limit exceeded: maximum 5 pending challenges per hour')
    }

    // Generate a unique challenge ID
    const challengeId = `ch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    // Resolve challenger username from user:meta
    const challengerMetaRaw = await redis.hGet('user:meta', challengerId)
    const challengerMeta = challengerMetaRaw
        ? (JSON.parse(challengerMetaRaw) as { username: string; avatarUrl: string | null })
        : null
    const challengerUsername = challengerMeta?.username ?? 'Unknown'

    // Create challenge hash (12.1)
    await redis.hSet(challengeKey(challengeId), {
        state: 'pending',
        challengerId,
        opponentId,
        challengerUsername,
        opponentUsername,
        puzzleId,
        createdAt: new Date().toISOString(),
    })
    // Set 1-hour TTL on challenge hash (12.2)
    await redis.expire(challengeKey(challengeId), CHALLENGE_PENDING_TTL_SECONDS)

    // Push to opponent's pending inbox with 1-hour TTL (12.3)
    await (redis as unknown as { lPush: (key: string, value: string) => Promise<number> })
        .lPush(pendingInboxKey(opponentId), challengeId)
    await redis.expire(pendingInboxKey(opponentId), CHALLENGE_PENDING_TTL_SECONDS)

    // Set dedup lock with 1-hour TTL (12.4)
    await redis.set(activePairKey(pairKey), challengeId)
    await redis.expire(activePairKey(pairKey), CHALLENGE_PENDING_TTL_SECONDS)

    // Increment challenges_sent counter (12.5)
    const today = todayISO()
    await redis.incrBy(challengesSentKey(today), 1)
    await redis.expire(challengesSentKey(today), CHALLENGES_SENT_TTL_SECONDS)

    const hash = await redis.hGetAll(challengeKey(challengeId))
    return parseChallengeHash(hash, challengeId)
}

// Type-cast helpers for Redis list operations not in the Devvit mock typings
type RedisWithListOps = {
    lRem: (key: string, count: number, value: string) => Promise<number>
    lPush: (key: string, value: string) => Promise<number>
    lTrim: (key: string, start: number, stop: number) => Promise<void>
    lRange: (key: string, start: number, stop: number) => Promise<string[]>
}

const redisList = redis as unknown as RedisWithListOps

/**
 * Transitions a challenge from `pending` to `active`.
 * Sets a 30-minute TTL on the challenge hash and removes the challengeId
 * from the opponent's pending inbox.
 *
 * Requirements: 13.2, 13.3, 13.4, 13.5
 */
export const acceptChallenge = async (
    challengeId: string,
    userId: string
): Promise<Challenge> => {
    const hash = await redis.hGetAll(challengeKey(challengeId))
    if (!hash?.state) throw new Error('Challenge not found')

    if (!isValidTransition(hash.state as ChallengeState, 'accept')) {
        throw new Error(`Cannot accept challenge in state: ${hash.state}`)
    }
    if (hash.opponentId !== userId) {
        throw new Error('Only the opponent can accept this challenge')
    }

    await redis.hSet(challengeKey(challengeId), {
        state: 'active',
        startedAt: new Date().toISOString(),
    })
    // Update TTL to 30 minutes for active challenge (13.3)
    await redis.expire(challengeKey(challengeId), CHALLENGE_ACTIVE_TTL_SECONDS)

    // Remove from opponent's pending inbox (13.4)
    await redisList.lRem(pendingInboxKey(userId), 1, challengeId)

    const updated = await redis.hGetAll(challengeKey(challengeId))
    return parseChallengeHash(updated, challengeId)
}

/**
 * Records a participant's solve time. When both players have submitted,
 * determines the winner, transitions to `finished`, increments the daily
 * challenges_completed counter, and appends the result to both participants'
 * history lists (trimmed to 20 entries).
 *
 * Requirements: 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 15.6
 */
export const completeChallenge = async (
    challengeId: string,
    userId: string,
    solveTime: number
): Promise<ChallengeResult | Challenge> => {
    const hash = await redis.hGetAll(challengeKey(challengeId))
    if (!hash?.state) throw new Error('Challenge not found')

    if (!isValidTransition(hash.state as ChallengeState, 'complete')) {
        throw new Error(`Cannot complete challenge in state: ${hash.state}`)
    }

    // Only participants may submit (14.3)
    if (userId !== hash.challengerId && userId !== hash.opponentId) {
        throw new Error('Only challenge participants can submit solve times')
    }

    // Record this player's time (14.2)
    const timeField = userId === hash.challengerId ? 'challengerTime' : 'opponentTime'
    await redis.hSet(challengeKey(challengeId), { [timeField]: String(solveTime) })

    const updated = await redis.hGetAll(challengeKey(challengeId))

    // Both players have completed — determine winner (14.4, 14.5)
    if (updated.challengerTime && updated.opponentTime) {
        const cTime = Number.parseFloat(updated.challengerTime)
        const oTime = Number.parseFloat(updated.opponentTime)
        const { winner: winnerRole, margin } = determineWinner(cTime, oTime)
        const winnerId = winnerRole === 'challenger' ? updated.challengerId : updated.opponentId
        const loserId = winnerRole === 'challenger' ? updated.opponentId : updated.challengerId

        await redis.hSet(challengeKey(challengeId), {
            state: 'finished',
            winner: winnerId ?? '',
            margin: String(margin),
        })

        // Increment challenges_completed counter (14.6)
        const today = todayISO()
        await redis.incrBy(challengesCompletedKey(today), 1)
        await redis.expire(challengesCompletedKey(today), CHALLENGES_COMPLETED_TTL_SECONDS)

        // Build result and append to both participants' history (14.8, 15.6)
        const result: ChallengeResult = {
            challengeId,
            winner: winnerId ?? '',
            loser: loserId ?? '',
            winnerTime: winnerRole === 'challenger' ? cTime : oTime,
            loserTime: winnerRole === 'challenger' ? oTime : cTime,
            margin,
        }

        const historyEntry = JSON.stringify(result)
        for (const participantId of [updated.challengerId, updated.opponentId]) {
            if (!participantId) continue
            const hKey = historyKey(participantId)
            await redisList.lPush(hKey, historyEntry)
            await redisList.lTrim(hKey, 0, CHALLENGE_HISTORY_MAX_ENTRIES - 1)
        }

        return result
    }

    return parseChallengeHash(updated, challengeId)
}

/**
 * Returns the current state of a challenge, or an expired sentinel when the
 * Redis key is absent (TTL elapsed).
 *
 * Requirements: 15.5
 */
export const getChallengeStatus = async (
    challengeId: string
): Promise<Challenge | { state: 'expired'; reason: 'timeout' }> => {
    const hash = await redis.hGetAll(challengeKey(challengeId))
    if (!hash?.state) {
        return { state: 'expired', reason: 'timeout' }
    }
    return parseChallengeHash(hash, challengeId)
}

/**
 * Returns all pending challenges for a user by reading their pending inbox list.
 * Silently skips any challengeIds whose Redis keys have already expired.
 *
 * Requirements: 13.1
 */
export const getPendingChallenges = async (userId: string): Promise<Challenge[]> => {
    const challengeIds = await redisList.lRange(pendingInboxKey(userId), 0, -1)
    const challenges = await Promise.all(
        challengeIds.map(async (id) => {
            const hash = await redis.hGetAll(challengeKey(id))
            if (!hash?.state) return null
            return parseChallengeHash(hash, id)
        })
    )
    return challenges.filter((c): c is Challenge => c !== null)
}
