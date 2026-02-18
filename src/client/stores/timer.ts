import { writable } from 'svelte/store'
import { formatTime } from '../../shared/utils/format'

const elapsedSeconds = writable(0)

let interval: ReturnType<typeof setInterval> | null = null
const TICK_MS = 1000

const canUseWindow = () => typeof window !== 'undefined'

export const startTimer = () => {
  if (!canUseWindow()) {
    return
  }
  if (interval) {
    return
  }
  interval = setInterval(() => {
    elapsedSeconds.update((value) => value + 1)
  }, TICK_MS)
}

export const stopTimer = () => {
  if (!interval) {
    return
  }
  clearInterval(interval)
  interval = null
}

export const resetTimer = () => {
  stopTimer()
  elapsedSeconds.set(0)
}

export const formatElapsedTime = formatTime

export { elapsedSeconds }
