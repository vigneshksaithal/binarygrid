/** A player's saved `user:{id}:economy` record, kept untouched since coins were retired. */
export type UserEconomy = {
  coins: number
  totalCoins: number
  totalSolves: number
  speedSolves: number
  equippedTitle: string
  ownedTitles: string[]
  dailyFirstSolve: string | null
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

/** A title as the boards show it beside a player's name. */
export type PlayerTitle = Pick<TitleDef, 'emoji' | 'label'>
