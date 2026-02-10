import { writable } from 'svelte/store'
import type { LeaderboardEntry } from '../../shared/types/leaderboard'

export type RankState = {
    rank: number | null
    totalEntries: number | null
    isLoading: boolean
    playerEntry: LeaderboardEntry | null
    streak: number | null
    bestStreak: number | null
}

const initialState: RankState = {
    rank: null,
    totalEntries: null,
    isLoading: false,
    playerEntry: null,
    streak: null,
    bestStreak: null,
}

export const rankStore = writable<RankState>(initialState)

export const fetchRank = async (puzzleId: string): Promise<void> => {
    rankStore.update((s) => ({ ...s, isLoading: true }))

    try {
        const res = await fetch(`/api/leaderboard?puzzleId=${puzzleId}`)
        if (!res.ok) {
            resetRank()
            return
        }

        const data = await res.json()
        const playerEntry = data.playerEntry as LeaderboardEntry | null

        if (playerEntry) {
            rankStore.set({
                rank: playerEntry.rank,
                totalEntries: data.totalEntries,
                isLoading: false,
                playerEntry,
                streak: data.streak ?? null,
                bestStreak: data.bestStreak ?? null,
            })
        } else {
            resetRank()
        }
    } catch {
        resetRank()
    }
}

export const setRank = (rank: number, totalEntries: number): void => {
    rankStore.set({
        rank,
        totalEntries,
        isLoading: false,
        playerEntry: null,
        streak: null,
        bestStreak: null,
    })
}

export const setStreak = (streak: number | null, bestStreak: number | null) => {
    rankStore.update((state) => ({
        ...state,
        streak,
        bestStreak,
    }))
}

export const resetRank = (): void => {
    rankStore.set(initialState)
}

export const calculatePercentile = (rank: number, total: number): number => {
    if (total <= 1) {
        return 100
    }
    return Math.round((rank / total) * 100)
}
