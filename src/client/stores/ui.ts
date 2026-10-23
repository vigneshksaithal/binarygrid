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

/**
 * The subreddit's first-screen switch, as the last puzzle reply reported it.
 * Unknown until a reply says, so a switched-off frame never shows its lines
 * while the first load runs.
 */
export type FirstScreenSwitch = 'unknown' | 'on' | 'off'

export const firstScreenSwitch = writable<FirstScreenSwitch>('unknown')

export const setFirstScreenSwitch = (on: boolean) => firstScreenSwitch.set(on ? 'on' : 'off')

export const hasJoinedSubreddit = writable(true)

export const setHasJoinedSubreddit = (joined: boolean) =>
    hasJoinedSubreddit.set(joined)
