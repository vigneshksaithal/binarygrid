import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadStreak,
  recordCompletion,
  type StreakState,
  streak
} from './streak'

const createResponse = (options: {
  ok: boolean
  status?: number
  payload?: unknown
}): Pick<Response, 'ok' | 'status' | 'json'> => ({
  ok: options.ok,
  status: options.status ?? (options.ok ? 200 : 500),
  json: async () => options.payload
})

describe('streak store', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    streak.set({ current: 0, longest: 0, lastPlayed: null })
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('loads streak data from the API', async () => {
    const payload: StreakState = {
      current: 3,
      longest: 5,
      lastPlayed: '2024-02-15'
    }
    fetchMock.mockResolvedValueOnce(
      createResponse({ ok: true, payload: { streak: payload } })
    )

    const result = await loadStreak()

    expect(fetch).toHaveBeenCalledWith('/api/streak')
    expect(result).toEqual(payload)
    expect(get(streak)).toEqual(payload)
  })

  it('falls back to defaults when the API fails', async () => {
    fetchMock.mockResolvedValueOnce(createResponse({ ok: false, status: 500 }))

    const result = await loadStreak()

    expect(result).toEqual({ current: 0, longest: 0, lastPlayed: null })
    expect(get(streak)).toEqual({ current: 0, longest: 0, lastPlayed: null })
  })

  it('records a completion and syncs with the API', async () => {
    const expected: StreakState = {
      current: 2,
      longest: 2,
      lastPlayed: '2024-02-02'
    }
    fetchMock.mockResolvedValueOnce(
      createResponse({ ok: true, payload: { streak: expected } })
    )

    const result = await recordCompletion('2024-02-02')

    expect(fetch).toHaveBeenCalledWith('/api/streak', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date: '2024-02-02' })
    })
    expect(result).toEqual(expected)
    expect(get(streak)).toEqual(expected)
  })

  it('keeps optimistic value when API request fails', async () => {
    fetchMock.mockResolvedValueOnce(createResponse({ ok: false, status: 500 }))

    const result = await recordCompletion('2024-02-03')

    expect(result).toEqual({
      current: 1,
      longest: 1,
      lastPlayed: '2024-02-03'
    })
    expect(get(streak)).toEqual({
      current: 1,
      longest: 1,
      lastPlayed: '2024-02-03'
    })
  })
})
