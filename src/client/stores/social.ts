import { writable } from 'svelte/store'
import type { SocialProofData } from '../../shared/viral-types'

export const socialStore = writable<SocialProofData | null>(null)

let pollingInterval: ReturnType<typeof setInterval> | null = null

const fetchSocialProof = async (postId: string): Promise<void> => {
    try {
        const res = await fetch(`/api/social/presence?postId=${encodeURIComponent(postId)}`)
        if (!res.ok) return
        const data = (await res.json()) as SocialProofData
        socialStore.set(data)
    } catch {
        // Polling must never interrupt play
    }
}

export const startSocialPolling = (postId: string): (() => void) => {
    // Fetch immediately on start
    fetchSocialProof(postId)

    // Then poll every 15 seconds
    pollingInterval = setInterval(() => fetchSocialProof(postId), 15000)

    // Return cleanup function
    return () => stopSocialPolling()
}

export const stopSocialPolling = (): void => {
    if (pollingInterval !== null) {
        clearInterval(pollingInterval)
        pollingInterval = null
    }
}

export const sendHeartbeat = async (postId: string): Promise<void> => {
    try {
        await fetch('/api/social/heartbeat', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ postId }),
        })
    } catch {
        // Heartbeat must never interrupt play
    }
}
