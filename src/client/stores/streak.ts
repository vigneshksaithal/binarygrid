import { writable, type Writable } from 'svelte/store'
import type { StreakData } from '../../shared/types/streak'

export type StreakState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  data: StreakData
}

const initial: StreakState = {
  status: 'idle',
  data: { currentStreak: 0, longestStreak: 0, todayCompleted: false }
}

export const streakStore: Writable<StreakState> = writable<StreakState>({ ...initial })

export const fetchStreak = async (): Promise<void> => {
  streakStore.update(s => ({ ...s, status: 'loading' }))
  try {
    const res = await fetch('/api/streak')
    if (!res.ok) throw new Error('Failed')
    const data = await res.json()
    streakStore.set({ 
      status: 'ready', 
      data: {
        currentStreak: data.currentStreak ?? 0,
        longestStreak: data.longestStreak ?? 0,
        todayCompleted: data.todayCompleted ?? false
      }
    })
  } catch {
    streakStore.update(s => ({ ...s, status: 'error' }))
  }
}

export const updateStreakFromSubmit = (streak: StreakData) => {
  streakStore.set({ status: 'ready', data: streak })
}
