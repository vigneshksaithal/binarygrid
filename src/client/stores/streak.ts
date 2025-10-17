import { get, writable } from 'svelte/store'
import {
  computeNextStreak,
  DEFAULT_STREAK,
  normalizeStreak,
  type Streak
} from '../../shared/streak'

export type StreakState = Streak

export const streak = writable<StreakState>(DEFAULT_STREAK)

const todayISO = (): string => new Date().toISOString().slice(0, 10)

export const loadStreak = async (): Promise<StreakState> => {
  try {
    const res = await fetch('/api/streak')
    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`)
    }
    const data = (await res.json()) as { streak: unknown }
    const parsed = normalizeStreak(data?.streak)
    streak.set(parsed)
    return parsed
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: surface failure in devtools
    console.warn('Failed to load streak from API', error)
    const fallback = { ...DEFAULT_STREAK }
    streak.set(fallback)
    return fallback
  }
}

export const recordCompletion = async (
  dateISO = todayISO()
): Promise<StreakState> => {
  const optimistic = computeNextStreak(get(streak), dateISO)
  streak.set(optimistic)
  try {
    const res = await fetch('/api/streak', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date: dateISO })
    })
    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`)
    }
    const data = (await res.json()) as { streak: unknown }
    const parsed = normalizeStreak(data?.streak)
    streak.set(parsed)
    return parsed
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: surface failure in devtools
    console.warn('Failed to record completion, using optimistic streak', error)
    return optimistic
  }
}
