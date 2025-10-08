import { writable } from 'svelte/store'

export const showHowToModal = writable(false)

export const openHowTo = () => showHowToModal.set(true)
export const closeHowTo = () => showHowToModal.set(false)
