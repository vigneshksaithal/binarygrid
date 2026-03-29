export type UserEconomy = {
  coins: number
  totalCoins: number
  totalSolves: number
  speedSolves: number
  equippedTitle: string
  ownedTitles: string[]
  dailyFirstSolve: string | null
}

export type CoinReward = {
  base: number
  streakBonus: number
  speedBonus: number
  dailyBonus: number
  total: number
}

export type TitleDef = {
  id: string
  emoji: string
  label: string
  cost: number
  condition?: {
    type: 'minSolves' | 'minSpeedSolves' | 'minLongestStreak'
    value: number
  }
}

export type ShopItem = TitleDef & {
  owned: boolean
  equipped: boolean
  unlocked: boolean
}

export type ShopResponse = {
  items: ShopItem[]
  coins: number
}

export type BuyTitleRequest = { titleId: string }
export type BuyTitleResponse = { success: boolean; newBalance?: number; error?: string }
export type EquipTitleRequest = { titleId: string }
export type EquipTitleResponse = { success: boolean; error?: string }
