import { redis } from '@devvit/web/server'
import { calculateKFactor } from '../../shared/viral-analytics'
import type { DailyViralMetrics, FunnelEvent, FunnelMetrics } from '../../shared/viral-types'
import { todayISO } from '../routes/utils'

// TTL constants
const DAU_TTL_SECONDS = 60 * 60 * 24 * 60       // 60 days
const IMPRESSIONS_TTL_SECONDS = 60 * 60 * 24 * 60 // 60 days

// Redis key helpers
const dauKey = (date: string) => `viral:dau:${date}`
const impressionsKey = (date: string) => `viral:impressions:${date}`

/**
 * Returns a stable, unique bit index for the given userId.
 *
 * On first call for a userId, atomically allocates the next available index
 * via `viral:user-index:counter` and persists the mapping in the
 * `viral:user-index` hash. Subsequent calls re-read the stored index
 * (idempotent). A final re-read after hSet handles the rare race where two
 * concurrent requests allocate different indices for the same user — the
 * first writer wins and both callers converge on the same value.
 *
 * Requirements: 1.2, 1.3
 */
export const getUserBitIndex = async (userId: string): Promise<number> => {
    const existing = await redis.hGet('viral:user-index', userId)
    if (existing !== null && existing !== undefined) {
        return Number.parseInt(existing, 10)
    }

    // Atomically allocate the next index
    const newIndex = await redis.incrBy('viral:user-index:counter', 1)

    // Persist the mapping; if a concurrent request already wrote it, hSet
    // will overwrite with our value — the re-read below resolves the winner
    await redis.hSet('viral:user-index', { [userId]: String(newIndex) })

    // Re-read to converge on whichever value was stored first
    const confirmed = await redis.hGet('viral:user-index', userId)
    return Number.parseInt(confirmed!, 10)
}

/**
 * Records the user as active for the given date by setting their bit in the
 * daily DAU bitmap `viral:dau:{date}`. Applies a 60-day TTL.
 *
 * Requirements: 1.1, 1.5
 */
export const trackDau = async (userId: string, date: string): Promise<void> => {
    const bitIndex = await getUserBitIndex(userId)
    const key = dauKey(date)
    // setBit is available on the real Devvit Redis client
    await (redis as unknown as { setBit: (key: string, offset: number, value: number) => Promise<number> })
        .setBit(key, bitIndex, 1)
    await redis.expire(key, DAU_TTL_SECONDS)
}

/**
 * Records a post impression for the given date using HyperLogLog
 * (`PFADD viral:impressions:{date}`). Applies a 60-day TTL.
 *
 * Requirements: 1.4, 1.5
 */
export const trackImpression = async (postId: string, date: string): Promise<void> => {
    const key = impressionsKey(date)
    // pfAdd is available on the real Devvit Redis client
    await (redis as unknown as { pfAdd: (key: string, elements: string[]) => Promise<number> })
        .pfAdd(key, [postId])
    await redis.expire(key, IMPRESSIONS_TTL_SECONDS)
}

// TTL constants for funnel and daily event counters
const FUNNEL_TTL_SECONDS = 60 * 60 * 24 * 60      // 60 days
const DAILY_EVENT_TTL_SECONDS = 60 * 60 * 24 * 60  // 60 days

// Redis key helpers for funnel and daily event counters
const funnelKey = (date: string, event: string) => `viral:funnel:${date}:${event}`
const dailySharesKey = (date: string) => `viral:daily:${date}:shares`
const dailyReferredOpensKey = (date: string) => `viral:daily:${date}:referred_opens`
const dailyReferredConvertsKey = (date: string) => `viral:daily:${date}:referred_converts`

/**
 * Increments the funnel stage counter for the given event and date.
 * Key: `viral:funnel:{date}:{event}` — INCRBY 1, TTL=60 days.
 *
 * Requirements: 2.1
 */
export const trackFunnelEvent = async (event: FunnelEvent, date: string): Promise<void> => {
    const key = funnelKey(date, event)
    await redis.incrBy(key, 1)
    await redis.expire(key, FUNNEL_TTL_SECONDS)
}

/**
 * Increments the global daily share counter for the given date.
 * Key: `viral:daily:{date}:shares` — INCRBY 1, TTL=60 days.
 * The userId is accepted for future attribution but the counter itself is global.
 *
 * Requirements: 2.4
 */
export const trackShare = async (_userId: string, date: string): Promise<void> => {
    const key = dailySharesKey(date)
    await redis.incrBy(key, 1)
    await redis.expire(key, DAILY_EVENT_TTL_SECONDS)
}

// Per-user referral open flag key: used to check if a user arrived via referral today
const userReferralOpenKey = (userId: string, date: string) =>
    `viral:referral_open:${userId}:${date}`

/**
 * Increments the global daily referred-opens counter for the given date and
 * sets a per-user flag so that the submit route can detect a same-day
 * referral open when checking for conversions.
 *
 * Keys written:
 *   - `viral:daily:{date}:referred_opens` — global counter, TTL=60 days
 *   - `viral:referral_open:{userId}:{date}` — per-user flag, TTL=60 days
 *
 * Requirements: 2.2, 16.3
 */
export const trackReferredOpen = async (userId: string, date: string): Promise<void> => {
    const globalKey = dailyReferredOpensKey(date)
    const userKey = userReferralOpenKey(userId, date)
    await Promise.all([
        redis.incrBy(globalKey, 1),
        redis.expire(globalKey, DAILY_EVENT_TTL_SECONDS),
        redis.set(userKey, '1'),
        redis.expire(userKey, DAILY_EVENT_TTL_SECONDS),
    ])
}

/**
 * Returns true if the user had a referred open recorded for the given date.
 * Used by the submit route to decide whether to count a puzzle completion
 * as a referred conversion (same-day rule per Requirement 16.3).
 */
export const hasReferredOpenToday = async (userId: string, date: string): Promise<boolean> => {
    const value = await redis.get(userReferralOpenKey(userId, date))
    return value !== null && value !== undefined
}

/**
 * Increments the global daily referred-conversions counter for the given date.
 * Key: `viral:daily:{date}:referred_converts` — INCRBY 1, TTL=60 days.
 * The userId is accepted for future attribution but the counter itself is global.
 *
 * Requirements: 2.3
 */
export const trackReferredConversion = async (_userId: string, date: string): Promise<void> => {
    const key = dailyReferredConvertsKey(date)
    await redis.incrBy(key, 1)
    await redis.expire(key, DAILY_EVENT_TTL_SECONDS)
}

// TTL constant for retention cohort bitmaps
const RETENTION_TTL_SECONDS = 60 * 60 * 24 * 90 // 90 days

// Redis key helpers for retention cohorts
const retentionKey = (offset: number, cohortDate: string) =>
    `viral:retention:d${offset}:${cohortDate}`

/**
 * Computes the number of whole days between two ISO date strings (YYYY-MM-DD).
 * Returns a non-negative integer; dateB is expected to be >= dateA.
 */
const daysBetween = (dateA: string, dateB: string): number => {
    const msPerDay = 1000 * 60 * 60 * 24
    const a = new Date(dateA).getTime()
    const b = new Date(dateB).getTime()
    return Math.round((b - a) / msPerDay)
}

/**
 * Called on every app open. On the user's first visit, records their cohort
 * date in `viral:user-cohorts`. On return visits, sets the appropriate bit in
 * the D1, D7, or D30 retention bitmap when the day offset matches exactly.
 * Also delegates DAU tracking to `trackDau` to avoid duplication.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
export const trackRetentionOnOpen = async (userId: string): Promise<void> => {
    const today = todayISO()

    // Delegate DAU tracking (sets bit + TTL)
    await trackDau(userId, today)

    // Get user's cohort date (first seen)
    const cohortDate = await redis.hGet('viral:user-cohorts', userId)
    if (!cohortDate) {
        // First-time user — register cohort
        await redis.hSet('viral:user-cohorts', { [userId]: today })
        await redis.expire('viral:user-cohorts', RETENTION_TTL_SECONDS)
        return
    }

    // Calculate days since first seen
    const daysSinceFirst = daysBetween(cohortDate, today)

    // Mark retention bitmaps for qualifying offsets
    const retentionOffsets = [1, 7, 30] as const
    for (const offset of retentionOffsets) {
        if (daysSinceFirst === offset) {
            const key = retentionKey(offset, cohortDate)
            const bitIndex = await getUserBitIndex(userId)
            await (redis as unknown as { setBit: (key: string, offset: number, value: number) => Promise<number> })
                .setBit(key, bitIndex, 1)
            await redis.expire(key, RETENTION_TTL_SECONDS)
        }
    }
}

/**
 * Returns the retention rate for a given cohort date and day offset.
 * Reads the retention bitmap (`viral:retention:d{dayOffset}:{cohortDate}`)
 * via BITCOUNT to get the retained count, and the DAU bitmap for the cohort
 * date to get the cohort size.
 *
 * Returns `retained / cohortSize`, or 0 if cohortSize is 0.
 * Falls back to 0 if bitCount is unavailable on the Redis client.
 *
 * Requirements: 3.5, 3.6
 */
export const getRetentionRate = async (
    cohortDate: string,
    dayOffset: number
): Promise<number> => {
    try {
        const [retained, cohortSize] = await Promise.all([
            (redis as unknown as { bitCount: (key: string) => Promise<number> })
                .bitCount(retentionKey(dayOffset, cohortDate)),
            (redis as unknown as { bitCount: (key: string) => Promise<number> })
                .bitCount(dauKey(cohortDate)),
        ])

        if (cohortSize === 0) return 0
        return retained / cohortSize
    } catch {
        return 0
    }
}

// ─── Metrics Aggregation Helpers ───────────────────────────────────────────

/**
 * Returns the ISO date string (YYYY-MM-DD) for n days ago.
 */
const getDateNDaysAgo = (n: number): string =>
    new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

/**
 * Reads a Redis counter key and returns its numeric value, defaulting to 0
 * when the key is absent or null.
 */
const getCounter = async (key: string): Promise<number> => {
    const value = await redis.get(key)
    if (value === null || value === undefined) return 0
    return Number.parseInt(value, 10)
}

// ─── Public Aggregation Functions ──────────────────────────────────────────

/**
 * Reads all 6 funnel stage counters for the given date.
 *
 * Requirements: 8.3
 */
export const getFunnelMetrics = async (date: string): Promise<FunnelMetrics> => {
    const [impression, open, start, complete, share, referOpen] = await Promise.all([
        getCounter(`viral:funnel:${date}:impression`),
        getCounter(`viral:funnel:${date}:open`),
        getCounter(`viral:funnel:${date}:start`),
        getCounter(`viral:funnel:${date}:complete`),
        getCounter(`viral:funnel:${date}:share`),
        getCounter(`viral:funnel:${date}:refer_open`),
    ])
    return { impression, open, start, complete, share, referOpen }
}

/**
 * Safely calls bitCount, returning 0 if the method is unavailable or throws.
 */
const safeBitCount = async (key: string): Promise<number> => {
    try {
        return await (redis as unknown as { bitCount: (key: string) => Promise<number> })
            .bitCount(key)
    } catch {
        return 0
    }
}

/**
 * Safely calls pfCount, returning 0 if the method is unavailable or throws.
 */
const safePfCount = async (key: string): Promise<number> => {
    try {
        return await (redis as unknown as { pfCount: (key: string) => Promise<number> })
            .pfCount(key)
    } catch {
        return 0
    }
}

/**
 * Reads all counters for a single date and assembles a `DailyViralMetrics`
 * object. Missing Redis keys default to 0. Type-cast Redis operations
 * (bitCount, pfCount) are wrapped in try-catch to prevent failures when
 * these methods are unavailable on the Devvit Redis client.
 *
 * Requirements: 8.1, 8.3, 8.4, 8.5, 8.6
 */
export const getDailyMetrics = async (date: string): Promise<DailyViralMetrics> => {
    const [dau, impressions, shares, referredOpens, referredConversions,
        challengesSent, challengesCompleted, funnel,
        retentionD1, retentionD7, retentionD30] = await Promise.all([
            safeBitCount(`viral:dau:${date}`),
            safePfCount(`viral:impressions:${date}`),
            getCounter(`viral:daily:${date}:shares`),
            getCounter(`viral:daily:${date}:referred_opens`),
            getCounter(`viral:daily:${date}:referred_converts`),
            getCounter(`viral:daily:${date}:challenges_sent`),
            getCounter(`viral:daily:${date}:challenges_completed`),
            getFunnelMetrics(date),
            getRetentionRate(date, 1),
            getRetentionRate(date, 7),
            getRetentionRate(date, 30),
        ])

    const shareRate = dau > 0 ? shares / dau : 0
    const conversionRate = referredOpens > 0 ? referredConversions / referredOpens : 0
    const kFactor = calculateKFactor({ dau, shares, referredOpens, referredConversions })

    return {
        date, dau, impressions, shares, shareRate,
        referredOpens, referredConversions, conversionRate,
        kFactor, retentionD1, retentionD7, retentionD30,
        challengesSent, challengesCompleted, funnel,
    }
}

/**
 * Returns exactly `days` `DailyViralMetrics` entries ordered most-recent-first
 * (index 0 = today, index days-1 = oldest). Missing Redis data defaults to 0.
 * Uses Promise.all to fetch all days in parallel for better performance in
 * serverless environments.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */
export const aggregateMetrics = async (days: number): Promise<DailyViralMetrics[]> => {
    const dates = Array.from({ length: days }, (_, i) => getDateNDaysAgo(i))
    const results = await Promise.all(dates.map((date) => getDailyMetrics(date)))
    return results
}
