import { redis } from '@devvit/web/server'
import { pickShownTitle } from '../../shared/economy-constants'
import type { PlayerTitle, UserEconomy } from '../../shared/types/economy'

// Coins and the shop are retired. Nothing writes `user:{id}:economy` any more:
// it keeps each player's balance and bought titles, so the boards can show the
// titles and reverting the retirement brings everything back.

const ECONOMY_HASH_PREFIX = 'user'
const ECONOMY_HASH_FIELD = 'economy'

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

const getUserEconomy = async (userId: string): Promise<UserEconomy> => {
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
// getShownTitle
// ────────────────────────────────────────────

/**
 * The title the boards show beside a player's name, read straight from the
 * saved record (never from a display cache), or null for none.
 */
export const getShownTitle = async (userId: string): Promise<PlayerTitle | null> => {
  const { equippedTitle, ownedTitles } = await getUserEconomy(userId)
  const title = pickShownTitle(equippedTitle, ownedTitles)
  return title ? { emoji: title.emoji, label: title.label } : null
}

/** Shown titles for several players, in the order given. */
export const getShownTitles = (userIds: readonly string[]): Promise<(PlayerTitle | null)[]> =>
  Promise.all(userIds.map((userId) => getShownTitle(userId)))
