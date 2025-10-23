import { writable } from 'svelte/store'

export const showHowToModal = writable(false)

export const openHowToModal = () => showHowToModal.set(true)
export const closeHowTo = () => showHowToModal.set(false)

export const showSuccessModal = writable(false)

export const openSuccessModal = () => showSuccessModal.set(true)
export const closeSuccessModal = () => showSuccessModal.set(false)
