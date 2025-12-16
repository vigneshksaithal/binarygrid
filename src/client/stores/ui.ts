import { writable } from 'svelte/store'

export const showHowToModal = writable(false)

export const openHowToModal = () => showHowToModal.set(true)
export const closeHowTo = () => showHowToModal.set(false)

export const showSuccessModal = writable(false)

export const openSuccessModal = () => showSuccessModal.set(true)
export const closeSuccessModal = () => showSuccessModal.set(false)

export const showLeaderboardModal = writable(false)

export const openLeaderboardModal = () => showLeaderboardModal.set(true)
export const closeLeaderboardModal = () => showLeaderboardModal.set(false)

export const showPlayOverlay = writable(false)

export const openPlayOverlay = () => showPlayOverlay.set(true)
export const closePlayOverlay = () => showPlayOverlay.set(false)

export const hasJoinedSubreddit = writable(false)

export const setHasJoinedSubreddit = (joined: boolean) =>
    hasJoinedSubreddit.set(joined)
