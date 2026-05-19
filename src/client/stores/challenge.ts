import { writable } from 'svelte/store'
import type { Challenge, ChallengeNotification, ChallengeResult } from '../../shared/viral-types'

type ChallengeState = {
    pending: ChallengeNotification[]
    active: Challenge | null
    result: ChallengeResult | null
}

const initialState: ChallengeState = {
    pending: [],
    active: null,
    result: null,
}

export const challengeStore = writable<ChallengeState>(initialState)

let pendingInterval: ReturnType<typeof setInterval> | null = null
let activeInterval: ReturnType<typeof setInterval> | null = null

const fetchPendingChallenges = async (): Promise<void> => {
    try {
        const res = await fetch('/api/challenge/pending')
        if (!res.ok) return
        const data = await res.json() as { challenges: ChallengeNotification[] }
        challengeStore.update(state => ({ ...state, pending: data.challenges }))
    } catch {
        // Polling must never interrupt play
    }
}

export const startPendingPolling = (): void => {
    fetchPendingChallenges()
    pendingInterval = setInterval(fetchPendingChallenges, 10000)
}

const stopActivePolling = (): void => {
    if (activeInterval !== null) {
        clearInterval(activeInterval)
        activeInterval = null
    }
}

const fetchActiveChallenge = async (challengeId: string): Promise<void> => {
    try {
        const res = await fetch(`/api/challenge/${challengeId}/status`)
        if (!res.ok) return
        const data = await res.json() as Challenge | { state: 'expired'; reason: 'timeout' }

        if (data.state === 'finished') {
            // Challenge is done — stop polling and update result
            stopActivePolling()
            challengeStore.update(state => ({ ...state, active: data as Challenge }))
        } else if (data.state === 'expired') {
            stopActivePolling()
            challengeStore.update(state => ({ ...state, active: null }))
        } else {
            challengeStore.update(state => ({ ...state, active: data as Challenge }))
        }
    } catch {
        // Polling must never interrupt play
    }
}

export const startActivePolling = (challengeId: string): void => {
    stopActivePolling() // Clear any existing active polling
    fetchActiveChallenge(challengeId)
    activeInterval = setInterval(() => fetchActiveChallenge(challengeId), 3000)
}

export const stopAllPolling = (): void => {
    if (pendingInterval !== null) {
        clearInterval(pendingInterval)
        pendingInterval = null
    }
    stopActivePolling()
}

export const createChallenge = async (opponentUsername: string, puzzleId: string): Promise<void> => {
    const res = await fetch('/api/challenge/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ opponentUsername, puzzleId }),
    })
    if (!res.ok) {
        const data = await res.json() as { error: string }
        throw new Error(data.error ?? 'Failed to create challenge')
    }
}

export const acceptChallenge = async (challengeId: string): Promise<void> => {
    const res = await fetch('/api/challenge/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ challengeId }),
    })
    if (!res.ok) {
        const data = await res.json() as { error: string }
        throw new Error(data.error ?? 'Failed to accept challenge')
    }
    const challenge = await res.json() as Challenge
    challengeStore.update(state => ({ ...state, active: challenge }))
    startActivePolling(challengeId)
}

export const submitChallengeTime = async (challengeId: string, solveTime: number): Promise<void> => {
    const res = await fetch(`/api/challenge/${challengeId}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ solveTime }),
    })
    if (!res.ok) {
        const data = await res.json() as { error: string }
        throw new Error(data.error ?? 'Failed to submit challenge time')
    }
}
