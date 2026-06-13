import { writable } from 'svelte/store'
import { formatTime } from '../../shared/utils/format'

export const elapsedSeconds = writable(0)

const TICK_MS = 1000
const isBrowser = () => typeof document !== 'undefined'

let interval: ReturnType<typeof setInterval> | null = null

// True once the player has engaged (first cell/hint). Persists through
// pause/resume so visibilitychange can resume mid-game. Cleared on resetTimer.
let timerEngaged = false

export const startTimer = () => {
  if (!isBrowser() || interval) return
  timerEngaged = true
  interval = setInterval(() => elapsedSeconds.update((s) => s + 1), TICK_MS)
}

export const stopTimer = () => {
  // Does NOT clear timerEngaged — pause must still allow visibilitychange resume.
  if (!interval) return
  clearInterval(interval)
  interval = null
}

export const resetTimer = () => {
  stopTimer()
  timerEngaged = false
  elapsedSeconds.set(0)
}

// Single registration at module load — this is a singleton module.
if (isBrowser()) {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopTimer()
    } else if (timerEngaged && !interval) {
      startTimer()
    }
  })
}

export const formatElapsedTime = formatTime
