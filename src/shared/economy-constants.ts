import type { TitleDef } from './types/economy'

export const COIN_BASE = 10
export const COIN_STREAK_MULTIPLIER = 2
export const COIN_SPEED_BONUS = 5
export const COIN_DAILY_BONUS = 5

export const DIFFICULTY_MULTIPLIER: Record<string, number> = {
  easy: 1,
  medium: 1.5,
  hard: 2,
}

export const PAR_TIMES: Record<string, number> = {
  easy: 60,
  medium: 120,
  hard: 240,
}

export const TITLES: readonly TitleDef[] = [
  { id: 'puzzler', emoji: '🧩', label: 'Puzzler', cost: 0 },
  {
    id: 'streak_lord',
    emoji: '🔥',
    label: 'Streak Lord',
    cost: 100,
    condition: { type: 'minLongestStreak', value: 7 },
  },
  {
    id: 'speed_demon',
    emoji: '⚡',
    label: 'Speed Demon',
    cost: 150,
    condition: { type: 'minSpeedSolves', value: 10 },
  },
  {
    id: 'grid_master',
    emoji: '🏆',
    label: 'Grid Master',
    cost: 300,
    condition: { type: 'minSolves', value: 50 },
  },
  {
    id: 'binary_king',
    emoji: '👑',
    label: 'Binary King',
    cost: 500,
    condition: { type: 'minSolves', value: 100 },
  },
  {
    id: 'diamond_mind',
    emoji: '💎',
    label: 'Diamond Mind',
    cost: 1000,
    condition: { type: 'minLongestStreak', value: 30 },
  },
]

export const getTitleById = (id: string): TitleDef | undefined =>
  TITLES.find((t) => t.id === id)
