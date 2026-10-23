import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LOGIN_REQUIRED_CODE } from '../../shared/submit'
import type { FixedCell, Grid } from '../../shared/types/puzzle'
import { autosubmitIfSolved, cycleCell, loadPuzzle } from './game'
import { rankStore } from './rank'
import {
  awaitLoginReturn,
  resubmitAfterLogin,
  retrySubmit,
  startAttempt,
  SUBMIT_TIMEOUT_MS,
  submitSolve,
  submitStatus,
} from './submit'

type FetchReply = { ok: boolean; status: number; json: () => Promise<unknown> }
type SubmitBody = { attemptId: string; solveTimeSeconds: number }

const HTTP_OK = 200
const HANG = 'hang'
const EXPECTED_RETRY_DELAYS_MS = [1000, 3000, 9000]

const reply = (status: number, body: unknown): FetchReply => ({
  ok: status >= HTTP_OK && status < 300,
  status,
  json: async () => body,
})

const SAVED = reply(HTTP_OK, { ok: true, rank: 3, totalEntries: 10 })
const SERVER_ERROR = reply(500, { error: 'Submission failed' })
const LOGGED_OUT = reply(401, { error: 'login required', code: LOGIN_REQUIRED_CODE })
const OFFLINE = new TypeError('Failed to fetch')

// A solved grid with only (0, 0) left open: one tap, to ○, solves it.
const SOLUTION: Grid = [
  [0, 0, 1, 1, 0, 1],
  [1, 1, 0, 0, 1, 0],
  [0, 1, 0, 1, 0, 1],
  [1, 0, 1, 0, 1, 0],
  [0, 1, 1, 0, 0, 1],
  [1, 0, 0, 1, 1, 0],
]
const ONE_TAP_INITIAL: Grid = SOLUTION.map((row, r) =>
  row.map((value, c) => (r === 0 && c === 0 ? null : value))
)
const ONE_TAP_FIXED: FixedCell[] = SOLUTION.flatMap((row, r) =>
  row.flatMap((value, c) =>
    (r === 0 && c === 0) || value === null ? [] : [{ r, c, v: value }]
  )
)
const ONE_TAP_PUZZLE = {
  id: 't3_post:medium',
  size: 6,
  difficulty: 'medium',
  initial: ONE_TAP_INITIAL,
  fixed: ONE_TAP_FIXED,
}

const SOLVE = {
  id: 't3_post:medium',
  grid: SOLUTION,
  solveTimeSeconds: 95,
  hintsUsed: 0,
  mistakeCount: 0,
  undoCount: 0,
}

// Never answers, like a stalled connection; rejects only once the request is aborted.
const hangUntilAborted = (init?: RequestInit) =>
  new Promise<FetchReply>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  })

// Answers /api/submit with the given replies in order (throwing for an Error,
// stalling for HANG, then SAVED once they run out), serves ONE_TAP_PUZZLE, and
// says ok to the rest.
const stubFetch = (
  ...submitReplies: Array<FetchReply | Error | Promise<FetchReply> | typeof HANG>
) => {
  const queue = [...submitReplies]
  const fetchMock = vi.fn(async (url: string, init?: RequestInit): Promise<FetchReply> => {
    if (url.startsWith('/api/puzzle?')) return reply(HTTP_OK, { puzzle: ONE_TAP_PUZZLE })
    if (url !== '/api/submit') return reply(HTTP_OK, { ok: true })
    const next = queue.shift() ?? SAVED
    if (next === HANG) return hangUntilAborted(init)
    if (next instanceof Error) throw next
    return next
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const submitBodies = (fetchMock: ReturnType<typeof stubFetch>): SubmitBody[] =>
  fetchMock.mock.calls
    .filter(([url]) => url === '/api/submit')
    .map(([, init]) => JSON.parse(String(init?.body)) as SubmitBody)

const attemptIds = (fetchMock: ReturnType<typeof stubFetch>): Set<string> =>
  new Set(submitBodies(fetchMock).map((body) => body.attemptId))

const ignoreResult = () => {}

const solveLoadedPuzzle = async () => {
  await loadPuzzle('medium')
  cycleCell(0, 0)
  await autosubmitIfSolved()
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
  startAttempt()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('submitSolve', () => {
  it('shows Saving… while the submit is in flight, then Saved', async () => {
    let answer: (value: FetchReply) => void = () => {}
    stubFetch(new Promise<FetchReply>((resolve) => { answer = resolve }))

    const saving = submitSolve(SOLVE, ignoreResult)
    expect(get(submitStatus)).toBe('saving')

    answer(SAVED)
    await saving
    expect(get(submitStatus)).toBe('saved')
  })

  it('retries a failed submit after 1, 3 and 9 seconds, resending the same attempt', async () => {
    const fetchMock = stubFetch(OFFLINE, OFFLINE, OFFLINE)

    const saving = submitSolve(SOLVE, ignoreResult)
    await vi.advanceTimersByTimeAsync(0)
    for (const [retry, delay] of EXPECTED_RETRY_DELAYS_MS.entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1)
      expect(submitBodies(fetchMock)).toHaveLength(retry + 1)
      await vi.advanceTimersByTimeAsync(1)
      expect(submitBodies(fetchMock)).toHaveLength(retry + 2)
    }
    await saving

    expect(get(submitStatus)).toBe('saved')
    expect(attemptIds(fetchMock).size).toBe(1)
    expect(submitBodies(fetchMock).every((body) => body.solveTimeSeconds === 95)).toBe(true)
  })

  it("shows Couldn't save once the retries run out, and Retry saves the same attempt", async () => {
    const fetchMock = stubFetch(OFFLINE, OFFLINE, OFFLINE, OFFLINE)

    const saving = submitSolve(SOLVE, ignoreResult)
    await vi.runAllTimersAsync()
    await saving
    expect(get(submitStatus)).toBe('failed')

    await retrySubmit()
    expect(get(submitStatus)).toBe('saved')
    expect(submitBodies(fetchMock)).toHaveLength(5)
    expect(attemptIds(fetchMock).size).toBe(1)
  })

  it('counts a submit that stalls past the timeout as failed, and retries it', async () => {
    const fetchMock = stubFetch(HANG)

    const saving = submitSolve(SOLVE, ignoreResult)
    await vi.advanceTimersByTimeAsync(SUBMIT_TIMEOUT_MS)
    expect(get(submitStatus)).toBe('saving')
    await vi.advanceTimersByTimeAsync(EXPECTED_RETRY_DELAYS_MS[0] ?? 0)
    await saving

    expect(submitBodies(fetchMock)).toHaveLength(2)
    expect(get(submitStatus)).toBe('saved')
  })

  it('treats an HTTP error like a network failure and retries it', async () => {
    const fetchMock = stubFetch(SERVER_ERROR)

    const saving = submitSolve(SOLVE, ignoreResult)
    await vi.runAllTimersAsync()
    await saving

    expect(submitBodies(fetchMock)).toHaveLength(2)
    expect(get(submitStatus)).toBe('saved')
  })

  it('stops at the login line for a logged-out solver instead of retrying', async () => {
    const fetchMock = stubFetch(LOGGED_OUT)

    const saving = submitSolve(SOLVE, ignoreResult)
    await vi.runAllTimersAsync()
    await saving

    expect(get(submitStatus)).toBe('login_required')
    expect(submitBodies(fetchMock)).toHaveLength(1)
  })

  it('resubmits the held solve once the player returns from the login prompt', async () => {
    const fetchMock = stubFetch(LOGGED_OUT, SAVED)
    await submitSolve(SOLVE, ignoreResult)

    awaitLoginReturn()
    await resubmitAfterLogin()

    expect(get(submitStatus)).toBe('saved')
    expect(submitBodies(fetchMock)).toHaveLength(2)
    expect(attemptIds(fetchMock).size).toBe(1)
  })

  it('never resubmits on its own unless the login prompt was opened', async () => {
    const fetchMock = stubFetch(LOGGED_OUT)
    await submitSolve(SOLVE, ignoreResult)

    await resubmitAfterLogin()

    expect(submitBodies(fetchMock)).toHaveLength(1)
    expect(get(submitStatus)).toBe('login_required')
  })

  it('sends one solve per attempt, however often autosubmit fires', async () => {
    const fetchMock = stubFetch()

    await Promise.all([submitSolve(SOLVE, ignoreResult), submitSolve(SOLVE, ignoreResult)])
    await submitSolve(SOLVE, ignoreResult)

    expect(submitBodies(fetchMock)).toHaveLength(1)
  })

  it('hands the saved result to the screen, and keeps Saved if showing it fails', async () => {
    stubFetch()
    const showResult = vi.fn(async () => {
      throw new Error('rank lookup failed')
    })

    await submitSolve(SOLVE, showResult)

    expect(showResult).toHaveBeenCalledWith({ ok: true, rank: 3, totalEntries: 10 })
    expect(get(submitStatus)).toBe('saved')
  })

  it('ignores a late result for a puzzle the player has left', async () => {
    let answer: (value: FetchReply) => void = () => {}
    stubFetch(new Promise<FetchReply>((resolve) => { answer = resolve }))
    const showResult = vi.fn()

    const saving = submitSolve(SOLVE, showResult)
    startAttempt()
    answer(SAVED)
    await saving

    expect(get(submitStatus)).toBe('idle')
    expect(showResult).not.toHaveBeenCalled()
  })
})

describe('autosubmitIfSolved', () => {
  it('sends the attempt ID made when the puzzle loaded, and a new one for the next puzzle', async () => {
    const fetchMock = stubFetch()

    await solveLoadedPuzzle()
    await solveLoadedPuzzle()

    const [first, second] = submitBodies(fetchMock)
    expect(first?.attemptId).toMatch(/^[A-Za-z0-9-]{8,64}$/)
    expect(second?.attemptId).toMatch(/^[A-Za-z0-9-]{8,64}$/)
    expect(second?.attemptId).not.toBe(first?.attemptId)
  })

  it('shows the saved rank and status on the result screen', async () => {
    stubFetch()

    await solveLoadedPuzzle()

    expect(get(submitStatus)).toBe('saved')
    expect(get(rankStore)).toMatchObject({ rank: 3, totalEntries: 10 })
  })
})
