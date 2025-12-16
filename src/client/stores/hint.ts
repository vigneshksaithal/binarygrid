import { writable, derived, get } from 'svelte/store'

const COOLDOWN_DURATION = 10000 // 10 seconds in milliseconds
const UPDATE_INTERVAL = 50 // Update every 50ms for smooth animation

type HintState = {
  lastHintTime: number | null
  cooldownEndTime: number | null
}

const initialState: HintState = {
  lastHintTime: null,
  cooldownEndTime: null
}

export const hintState = writable<HintState>(initialState)

let intervalId: ReturnType<typeof setInterval> | null = null

// Derived store for current progress (0-100)
export const cooldownProgress = writable(100)

// Derived store for whether hint can be used
export const canUseHint = derived(cooldownProgress, ($progress) => $progress >= 100)

const updateProgress = () => {
  const state = get(hintState)
  if (!state.cooldownEndTime) {
    cooldownProgress.set(100)
    return
  }

  const now = Date.now()
  const remaining = state.cooldownEndTime - now

  if (remaining <= 0) {
    cooldownProgress.set(100)
    hintState.update((s) => ({ ...s, cooldownEndTime: null }))
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    return
  }

  const elapsed = COOLDOWN_DURATION - remaining
  const progress = (elapsed / COOLDOWN_DURATION) * 100
  cooldownProgress.set(progress)
}

export const startCooldown = () => {
  const now = Date.now()
  hintState.set({
    lastHintTime: now,
    cooldownEndTime: now + COOLDOWN_DURATION
  })
  cooldownProgress.set(0)

  if (intervalId) {
    clearInterval(intervalId)
  }

  intervalId = setInterval(updateProgress, UPDATE_INTERVAL)
}

export const resetHintCooldown = () => {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  hintState.set(initialState)
  cooldownProgress.set(100)
}
