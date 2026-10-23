import { get, writable } from 'svelte/store'

/** This post's #N for the frame and the result screen, or null until the server answers. */
export const puzzleNumber = writable<number | null>(null)

const readDayNumber = (data: unknown): number | null => {
  if (typeof data !== 'object' || data === null || !('dayNumber' in data)) return null
  const { dayNumber } = data
  return typeof dayNumber === 'number' && Number.isInteger(dayNumber) && dayNumber >= 1
    ? dayNumber
    : null
}

/**
 * Fetches #N unless it's known. A failure leaves it unknown, so the next call,
 * such as the result screen opening, asks again.
 */
export const loadPuzzleNumber = async (): Promise<void> => {
  if (get(puzzleNumber) !== null) return
  try {
    const res = await fetch('/api/puzzle-number')
    if (!res.ok) return
    const dayNumber = readDayNumber(await res.json())
    if (dayNumber !== null) puzzleNumber.set(dayNumber)
  } catch {
    // #N stays unknown until a later call gets it.
  }
}
