import { writable } from 'svelte/store'
import type { LeaderboardEntry } from '../../shared/types/leaderboard'

type LeaderboardState = {
  top: LeaderboardEntry[]
  me: LeaderboardEntry | null
  peers: LeaderboardEntry[]
  loading: boolean
  error: string | null
}

const createLeaderboardStore = () => {
  const { subscribe, set, update } = writable<LeaderboardState>({
    top: [],
    me: null,
    peers: [],
    loading: false,
    error: null
  })

  const fetchTop = async (limit = 10) => {
    update((state) => ({ ...state, loading: true, error: null }))
    try {
      const response = await fetch(`/api/leaderboard/top?limit=${limit}`)
      if (!response.ok) {
        throw new Error('Failed to fetch top players')
      }
      const data = await response.json()
      update((state) => ({ ...state, top: data.rows, loading: false }))
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      update((state) => ({ ...state, error: errorMessage, loading: false }))
    }
  }

  const fetchMe = async (window = 5) => {
    update((state) => ({ ...state, loading: true, error: null }))
    try {
      const response = await fetch(`/api/leaderboard/me?window=${window}`)
      if (!response.ok) {
        throw new Error('Failed to fetch current user')
      }
      const data = await response.json()
      update((state) => ({
        ...state,
        me: data.me,
        peers: data.peers,
        loading: false
      }))
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      update((state) => ({ ...state, error: errorMessage, loading: false }))
    }
  }

  const submit = async (rawScore: number) => {
    update((state) => ({ ...state, loading: true, error: null }))
    try {
      const response = await fetch('/api/leaderboard/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawScore,
          achievedAt: Math.floor(Date.now() / 1000)
        })
      })
      if (!response.ok) {
        throw new Error('Failed to submit score')
      }
      // Refresh leaderboard after submission
      await Promise.all([fetchTop(), fetchMe()])
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      update((state) => ({ ...state, error: errorMessage, loading: false }))
    }
  }

  return {
    subscribe,
    fetchTop,
    fetchMe,
    submit
  }
}

export const leaderboard = createLeaderboardStore()
