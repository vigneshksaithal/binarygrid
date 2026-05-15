import { writable } from 'svelte/store'
import type { Difficulty } from '../../shared/types/puzzle'
import type { DailyMission, DailyTrioSummary, SolveQuality } from '../../shared/growth'

export type DailyProgress = {
  dateISO: string
  completedDifficulties: Difficulty[]
  trio: DailyTrioSummary
  streak: {
    currentStreak: number
    longestStreak: number
    freezes: number
    todayCompleted: boolean
    repairAvailable: boolean
  }
  missions: DailyMission[]
}

export type PlayerContext = {
  rank: number | null
  totalEntries: number
  fasterThanPercentile: number
  nextRankSeconds: number | null
  topTenCutoffSeconds: number | null
  bestDifficultyToday: Difficulty | null
  completedDifficulties: Difficulty[]
}

type GrowthState = {
  dailyProgress: DailyProgress | null
  playerContext: PlayerContext | null
  solveQuality: SolveQuality | null
}

const initialState: GrowthState = {
  dailyProgress: null,
  playerContext: null,
  solveQuality: null,
}

export const growthStore = writable<GrowthState>(initialState)

export const setDailyProgress = (dailyProgress: DailyProgress): void => {
  growthStore.update((state) => ({ ...state, dailyProgress }))
}

export const setPlayerContext = (playerContext: PlayerContext): void => {
  growthStore.update((state) => ({ ...state, playerContext }))
}

export const setSolveQuality = (solveQuality: SolveQuality): void => {
  growthStore.update((state) => ({ ...state, solveQuality }))
}

export const resetGrowth = (): void => {
  growthStore.set(initialState)
}

export const trackGrowthEvent = async (eventName: string): Promise<void> => {
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ eventName }),
    })
  } catch {
    // Analytics must never interrupt play.
  }
}

export const loadDailyProgress = async (): Promise<void> => {
  const res = await fetch('/api/daily-progress')
  if (!res.ok) return
  const data = await res.json()
  setDailyProgress(data)
}

export const loadPlayerContext = async (puzzleId: string): Promise<void> => {
  const query = new URLSearchParams({ puzzleId })
  const res = await fetch(`/api/player-context?${query.toString()}`)
  if (!res.ok) return
  const data = await res.json()
  setPlayerContext(data)
}
