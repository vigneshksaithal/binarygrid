import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyGrid } from '../../shared/utils/grid'
import { PUZZLE_LOAD_TIMEOUT_MS } from '../services/puzzle-api'
import { game, loadPuzzle, retryPuzzleLoad } from './game'
import { showFirstScreen } from './ui'

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

// A load names its tier in the query; without one the server picks the tier.
const isPuzzleRequest = (url: string): boolean =>
  url === '/api/puzzle' || url.startsWith('/api/puzzle?')

// Answers /api/puzzle with the given replies in order (throwing for an Error,
// stalling for HANG), then with HARD_PUZZLE, and says ok to every other call.
const stubPuzzleFetch = (...puzzleReplies: Array<FetchReply | Error | typeof HANG>) => {
  const queue = [...puzzleReplies]
  const fetchMock = vi.fn(async (url: string, init?: RequestInit): Promise<FetchReply> => {
    if (!isPuzzleRequest(url)) return reply(HTTP_OK, { ok: true })
    const next = queue.shift() ?? reply(HTTP_OK, { puzzle: HARD_PUZZLE })
    if (next === HANG) return hangUntilAborted(init)
    if (next instanceof Error) throw next
    return next
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const puzzleRequestsOf = (fetchMock: ReturnType<typeof stubPuzzleFetch>): string[] =>
  fetchMock.mock.calls.map(([url]) => url).filter(isPuzzleRequest)

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
    ['the puzzle names no known tier', reply(HTTP_OK, { puzzle: { ...HARD_PUZZLE, difficulty: 'expert' } })],
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

describe('a load that names no tier', () => {
  it('lets the server pick the tier and plays the one it picked', async () => {
    const fetchMock = stubPuzzleFetch(reply(HTTP_OK, { puzzle: EASY_PUZZLE, firstScreen: true }))

    await loadPuzzle()

    expect(puzzleRequestsOf(fetchMock)).toEqual(['/api/puzzle'])
    expect(get(game)).toMatchObject({
      status: 'in_progress',
      difficulty: 'easy',
      puzzleId: 't3_post:easy',
    })
  })

  it('lets the server pick again when Retry follows a failed load', async () => {
    const fetchMock = stubPuzzleFetch(
      reply(500, { error: 'Failed to fetch puzzle' }),
      reply(HTTP_OK, { puzzle: EASY_PUZZLE })
    )
    await loadPuzzle()
    expect(get(game).status).toBe('error')

    await retryPuzzleLoad()

    expect(puzzleRequestsOf(fetchMock)).toEqual(['/api/puzzle', '/api/puzzle'])
    expect(get(game)).toMatchObject({ status: 'in_progress', difficulty: 'easy' })
  })
})

describe('the first-screen switch', () => {
  it('follows what each puzzle reply says', async () => {
    stubPuzzleFetch(
      reply(HTTP_OK, { puzzle: EASY_PUZZLE, firstScreen: false }),
      reply(HTTP_OK, { puzzle: HARD_PUZZLE, firstScreen: true })
    )

    await loadPuzzle()
    expect(get(showFirstScreen)).toBe(false)

    await loadPuzzle('hard')
    expect(get(showFirstScreen)).toBe(true)
  })

  it('stays on when a reply leaves it out', async () => {
    stubPuzzleFetch(
      reply(HTTP_OK, { puzzle: EASY_PUZZLE, firstScreen: false }),
      reply(HTTP_OK, { puzzle: HARD_PUZZLE })
    )

    await loadPuzzle()
    await loadPuzzle('hard')

    expect(get(showFirstScreen)).toBe(true)
  })
})
