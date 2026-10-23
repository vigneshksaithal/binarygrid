import { redis } from '@devvit/web/server'
import type { FunnelEvent } from '../../shared/viral-types'

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
