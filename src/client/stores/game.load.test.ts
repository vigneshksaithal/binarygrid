import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyGrid } from '../../shared/utils/grid'
import { PUZZLE_LOAD_TIMEOUT_MS } from '../services/puzzle-api'
import { game, loadPuzzle, retryPuzzleLoad } from './game'

type FetchReply = { ok: boolean; status: number; json: () => Promise<unknown> }

const HTTP_OK = 200
const HANG = 'hang'
const HARD_PUZZLE = {
  id: 't3_post:hard',
  size: 6,
  difficulty: 'hard',
  initial: createEmptyGrid(),
  fixed: [],
}
const EASY_PUZZLE = { ...HARD_PUZZLE, id: 't3_post:easy', difficulty: 'easy' }

const reply = (status: number, body: unknown): FetchReply => ({
  ok: status >= HTTP_OK && status < 300,
  status,
  json: async () => body,
})

// Never answers, like a stalled connection; rejects only once the request is aborted.
const hangUntilAborted = (init?: RequestInit) =>
  new Promise<FetchReply>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  })

// Answers /api/puzzle with the given replies in order (throwing for an Error,
// stalling for HANG), then with HARD_PUZZLE, and says ok to every other call.
const stubPuzzleFetch = (...puzzleReplies: Array<FetchReply | Error | typeof HANG>) => {
  const queue = [...puzzleReplies]
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit): Promise<FetchReply> => {
      if (!url.startsWith('/api/puzzle?')) return reply(HTTP_OK, { ok: true })
      const next = queue.shift() ?? reply(HTTP_OK, { puzzle: HARD_PUZZLE })
      if (next === HANG) return hangUntilAborted(init)
      if (next instanceof Error) throw next
      return next
    })
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('loadPuzzle failures', () => {
  it.each([
    ['the request throws', new TypeError('Failed to fetch')],
    ['the server answers HTTP 500', reply(500, { error: 'Failed to fetch puzzle' })],
    ['the response holds no puzzle', reply(HTTP_OK, {})],
  ])('ends in the error state, never an endless skeleton, when %s', async (_label, failure) => {
    stubPuzzleFetch(failure)

    await loadPuzzle('hard')

    expect(get(game).status).toBe('error')
  })

  it('ends in the error state when the request stalls past the load timeout', async () => {
    stubPuzzleFetch(HANG)

    const loading = loadPuzzle('hard')
    await vi.advanceTimersByTimeAsync(PUZZLE_LOAD_TIMEOUT_MS - 1)
    expect(get(game).status).toBe('loading')
    await vi.advanceTimersByTimeAsync(1)
    await loading

    expect(get(game).status).toBe('error')
  })

  it('remembers the tier that failed, so Retry loads it', async () => {
    stubPuzzleFetch(
      reply(HTTP_OK, { puzzle: EASY_PUZZLE }),
      reply(500, { error: 'Failed to fetch puzzle' })
    )
    await loadPuzzle('easy')
    await loadPuzzle('hard')
    expect(get(game)).toMatchObject({ status: 'error', difficulty: 'hard' })

    await retryPuzzleLoad()

    expect(get(game)).toMatchObject({
      status: 'in_progress',
      difficulty: 'hard',
      puzzleId: 't3_post:hard',
    })
  })
})
