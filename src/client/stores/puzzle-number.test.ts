import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadPuzzleNumber, puzzleNumber } from './puzzle-number'

type FetchReply = { ok: boolean; status: number; json: () => Promise<unknown> }

const HTTP_OK = 200
const HTTP_BAD_REQUEST = 400
const DAY_NUMBER = 128

const reply = (status: number, body: unknown): FetchReply => ({
  ok: status >= HTTP_OK && status < 300,
  status,
  json: async () => body,
})

// Answers each request with the next reply, throwing for an Error.
const stubFetch = (...replies: Array<FetchReply | Error>) => {
  const queue = [...replies]
  const fetchMock = vi.fn(async (_url: string): Promise<FetchReply> => {
    const next = queue.shift() ?? reply(HTTP_OK, { dayNumber: DAY_NUMBER })
    if (next instanceof Error) throw next
    return next
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  puzzleNumber.set(null)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loadPuzzleNumber', () => {
  it("keeps this post's #N from /api/puzzle-number", async () => {
    const fetchMock = stubFetch(reply(HTTP_OK, { dayNumber: DAY_NUMBER }))

    await loadPuzzleNumber()

    expect(fetchMock).toHaveBeenCalledWith('/api/puzzle-number')
    expect(get(puzzleNumber)).toBe(DAY_NUMBER)
  })

  it('asks no more once #N is known', async () => {
    const fetchMock = stubFetch(reply(HTTP_OK, { dayNumber: DAY_NUMBER }))

    await loadPuzzleNumber()
    await loadPuzzleNumber()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['the request throws', new TypeError('Failed to fetch')],
    ['the server answers with an error', reply(HTTP_BAD_REQUEST, { error: 'postId is required' })],
    ['the reply holds no number', reply(HTTP_OK, {})],
    ['the number is not a whole number from 1', reply(HTTP_OK, { dayNumber: 0 })],
  ])('leaves #N unknown when %s, so the next call asks again', async (_case, failure) => {
    const fetchMock = stubFetch(failure, reply(HTTP_OK, { dayNumber: DAY_NUMBER }))

    await loadPuzzleNumber()
    expect(get(puzzleNumber)).toBeNull()

    await loadPuzzleNumber()
    expect(get(puzzleNumber)).toBe(DAY_NUMBER)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
