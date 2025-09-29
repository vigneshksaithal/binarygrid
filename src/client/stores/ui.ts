import { writable } from 'svelte/store'

export const showHowTo = writable(false)

export const openHowTo = () => showHowTo.set(true)
export const closeHowTo = () => showHowTo.set(false)
