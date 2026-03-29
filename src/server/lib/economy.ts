import { reddit, redis } from '@devvit/web/server'
import {
  COIN_BASE,
  COIN_DAILY_BONUS,
  COIN_SPEED_BONUS,
  COIN_STREAK_MULTIPLIER,
  DIFFICULTY_MULTIPLIER,
  getTitleById,
  PAR_TIMES,
  TITLES,
} from '../../shared/economy-constants'
import type { CoinReward, ShopItem, UserEconomy } from '../../shared/types/economy'
import { DECIMAL_RADIX } from '../routes/utils'

const ECONOMY_HASH_PREFIX = 'user'
const ECONOMY_HASH_FIELD = 'economy'
const DISPLAY_CACHE_TTL = 86400 // 24h in seconds

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

const economyKey = (userId: string) => `${ECONOMY_HASH_PREFIX}:${userId}:economy`

const defaultEconomy = (): UserEconomy => ({
  coins: 0,
  totalCoins: 0,
  totalSolves: 0,
  speedSolves: 0,
  equippedTitle: 'puzzler',
  ownedTitles: ['puzzler'],
  dailyFirstSolve: null,
})

// ────────────────────────────────────────────
// getUserEconomy
// ────────────────────────────────────────────

export const getUserEconomy = async (userId: string): Promise<UserEconomy> => {
  try {
    const raw = await redis.hGet(economyKey(userId), ECONOMY_HASH_FIELD)
    if (!raw) return defaultEconomy()
    const parsed = JSON.parse(raw) as Partial<UserEconomy>
    const def = defaultEconomy()
    return {
      coins: typeof parsed.coins === 'number' ? parsed.coins : def.coins,
      totalCoins: typeof parsed.totalCoins === 'number' ? parsed.totalCoins : def.totalCoins,
      totalSolves: typeof parsed.totalSolves === 'number' ? parsed.totalSolves : def.totalSolves,
      speedSolves: typeof parsed.speedSolves === 'number' ? parsed.speedSolves : def.speedSolves,
      equippedTitle: typeof parsed.equippedTitle === 'string' ? parsed.equippedTitle : def.equippedTitle,
      ownedTitles: Array.isArray(parsed.ownedTitles) ? parsed.ownedTitles : def.ownedTitles,
      dailyFirstSolve: typeof parsed.dailyFirstSolve === 'string' ? parsed.dailyFirstSolve : def.dailyFirstSolve,
    }
  } catch {
    return defaultEconomy()
  }
}

// ────────────────────────────────────────────
// saveUserEconomy
// ────────────────────────────────────────────

export const saveUserEconomy = async (
  userId: string,
  partial: Partial<UserEconomy>
): Promise<UserEconomy> => {
  const current = await getUserEconomy(userId)
  const updated: UserEconomy = { ...current, ...partial }
  await redis.hSet(economyKey(userId), {
    [ECONOMY_HASH_FIELD]: JSON.stringify(updated),
  })
  return updated
}

// ────────────────────────────────────────────
// calculateCoinReward
// ────────────────────────────────────────────

export const calculateCoinReward = (
  timeTaken: number,
  difficulty: string,
  currentStreak: number,
  isDailyFirst: boolean
): CoinReward => {
  const diffMult = DIFFICULTY_MULTIPLIER[difficulty] ?? 1
  const base = Math.round(COIN_BASE * diffMult)

  const streakBonus = currentStreak > 1 ? Math.round((currentStreak - 1) * COIN_STREAK_MULTIPLIER * diffMult) : 0

  const parTime = PAR_TIMES[difficulty] ?? 120
  const speedBonus = timeTaken <= parTime ? Math.round(COIN_SPEED_BONUS * diffMult) : 0

  const dailyBonus = isDailyFirst ? Math.round(COIN_DAILY_BONUS * diffMult) : 0

  const total = base + streakBonus + speedBonus + dailyBonus

  return { base, streakBonus, speedBonus, dailyBonus, total }
}

// ────────────────────────────────────────────
// getUserStreakData
// ────────────────────────────────────────────

export type StreakData = {
  currentStreak: number
  longestStreak: number
  lastDate: string | null
}

export const getUserStreakData = async (userId: string): Promise<StreakData> => {
  const [currentStr, longestStr, lastDate] = await Promise.all([
    redis.get(`user:${userId}:streak:current`),
    redis.get(`user:${userId}:streak:longest`),
    redis.get(`user:${userId}:streak:lastDate`),
  ])
  return {
    currentStreak: currentStr ? Number.parseInt(currentStr, DECIMAL_RADIX) : 0,
    longestStreak: longestStr ? Number.parseInt(longestStr, DECIMAL_RADIX) : 0,
    lastDate: lastDate ?? null,
  }
}

// ────────────────────────────────────────────
// getShopItems
// ────────────────────────────────────────────

export const getShopItems = async (
  userId: string,
  streakData: StreakData
): Promise<ShopItem[]> => {
  const economy = await getUserEconomy(userId)

  return TITLES.map((title) => {
    const owned = economy.ownedTitles.includes(title.id)
    const equipped = economy.equippedTitle === title.id

    let unlocked = true
    if (title.condition) {
      const { type, value } = title.condition
      if (type === 'minSolves') {
        unlocked = economy.totalSolves >= value
      } else if (type === 'minSpeedSolves') {
        unlocked = economy.speedSolves >= value
      } else if (type === 'minLongestStreak') {
        unlocked = streakData.longestStreak >= value
      }
    }

    return { ...title, owned, equipped, unlocked }
  })
}

// ────────────────────────────────────────────
// getUserDisplay
// ────────────────────────────────────────────

export type UserDisplay = {
  username: string
  titleEmoji: string
  equippedTitle: string
}

export const getUserDisplay = async (
  targetUserId: string,
  _currentUserId?: string
): Promise<UserDisplay> => {
  const cacheKey = `user:${targetUserId}:display:cache`

  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached) as UserDisplay
    }
  } catch {
    // ignore cache read errors
  }

  // Fetch username
  let username = 'Unknown player'
  try {
    const metaRaw = await redis.hGet('user:meta', targetUserId)
    if (metaRaw) {
      const meta = JSON.parse(metaRaw) as { username?: string }
      if (meta.username) username = meta.username
    } else {
      // Try fetching from reddit API
      const user = await reddit.getCurrentUser().catch(() => null)
      if (user?.username) username = user.username
    }
  } catch {
    // ignore errors
  }

  // Fetch equipped title
  const economy = await getUserEconomy(targetUserId)
  const title = getTitleById(economy.equippedTitle)
  const titleEmoji = title?.emoji ?? '🧩'

  const display: UserDisplay = {
    username,
    titleEmoji,
    equippedTitle: economy.equippedTitle,
  }

  // Cache for 24h
  try {
    await redis.set(cacheKey, JSON.stringify(display))
    await redis.expire(cacheKey, DISPLAY_CACHE_TTL)
  } catch {
    // ignore cache write errors
  }

  return display
}

// ────────────────────────────────────────────
// invalidateDisplayCache
// ────────────────────────────────────────────

export const invalidateDisplayCache = async (userId: string): Promise<void> => {
  try {
    await redis.del(`user:${userId}:display:cache`)
  } catch {
    // ignore
  }
}
