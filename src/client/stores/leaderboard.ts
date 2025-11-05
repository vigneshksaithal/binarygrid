import { get, writable } from 'svelte/store'
import type {
  LeaderboardEntry,
  LeaderboardResponse
} from '../../shared/types/leaderboard'

type LeaderboardStatus = 'idle' | 'loading' | 'ready' | 'error'

type LeaderboardState = {
  status: LeaderboardStatus
  puzzleId: string | null
  entries: LeaderboardEntry[]
  playerEntry: LeaderboardEntry | null
  page: number
  pageSize: number
  totalEntries: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  error: string | null
}

const PAGE_SIZE = 10

const makeInitialState = (): LeaderboardState => ({
  status: 'idle',
  puzzleId: null,
  entries: [],
  playerEntry: null,
  page: 0,
  pageSize: PAGE_SIZE,
  totalEntries: 0,
  hasNextPage: false,
  hasPreviousPage: false,
  error: null
})

const initialState = makeInitialState()

export const leaderboard = writable<LeaderboardState>({ ...initialState })

export const loadLeaderboard = async (
  puzzleId: string | null,
  page = 0
): Promise<void> => {
  if (!puzzleId) {
    leaderboard.set(makeInitialState())
    return
  }

  leaderboard.update((state) => ({
    ...state,
    status: 'loading',
    puzzleId,
    page,
    error: null
  }))

  const query = new URLSearchParams({
    puzzleId,
    page: `${page}`,
    pageSize: `${PAGE_SIZE}`
  })

  try {
    const res = await fetch(`/api/leaderboard?${query.toString()}`)
    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`)
    }
    const data = (await res.json()) as LeaderboardResponse
    leaderboard.set({
      status: 'ready',
      puzzleId,
      error: null,
      ...data
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load leaderboard'
    leaderboard.set({
      ...makeInitialState(),
      status: 'error',
      puzzleId,
      error: message
    })
  }
}

export const goToLeaderboardPage = async (page: number): Promise<void> => {
  const state = get(leaderboard)
  if (!state.puzzleId || state.status === 'loading') {
    return
  }
  await loadLeaderboard(state.puzzleId, page)
}

export const resetLeaderboard = () => {
  leaderboard.set(makeInitialState())
}
