import { get } from 'svelte/store'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { LOGIN_REQUIRED_CODE } from '../../shared/submit'

const saved = () => ({ ok: true, json: async () => ({ ok: true }) })
const loggedOut = () => ({ ok: false, json: async () => ({ code: LOGIN_REQUIRED_CODE }) })
const failed = () => ({ ok: false, json: async () => ({}) })

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('keeps a failed earlier solve available for retry after starting another difficulty', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(failed()).mockResolvedValueOnce(failed())
    .mockResolvedValueOnce(failed()).mockResolvedValueOnce(failed()).mockResolvedValue(saved())
  vi.stubGlobal('fetch', fetchMock)
  const { submitSolve, startAttempt, pendingSolves, retryPendingSolve } = await import('./submit')
  const saving = submitSolve({ id: 'old:easy' }, () => {})
  startAttempt()
  await vi.runAllTimersAsync()
  await saving
  const [pending] = get(pendingSolves)
  expect(pending).toMatchObject({ puzzleId: 'old:easy', status: 'failed' })
  await retryPendingSolve(pending!.attemptId)
  expect(get(pendingSolves)).toHaveLength(0)
  const attempts = fetchMock.mock.calls.filter(([url]) => url === '/api/submit')
    .map(([, options]) => JSON.parse(options.body).attemptId)
  expect(new Set(attempts).size).toBe(1)
})

it('retains multiple logged-out solves and resends each after login without showing old result screens', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(loggedOut()).mockResolvedValueOnce(loggedOut()).mockResolvedValue(saved())
  vi.stubGlobal('fetch', fetchMock)
  const { submitSolve, startAttempt, pendingSolves, awaitLoginReturn, resubmitAfterLogin } = await import('./submit')
  const first = vi.fn()
  const second = vi.fn()
  await submitSolve({ id: 'post:easy' }, first)
  startAttempt()
  await submitSolve({ id: 'post:hard' }, second)
  startAttempt()
  expect(get(pendingSolves).map((entry) => entry.status)).toEqual(['login_required', 'login_required'])
  awaitLoginReturn()
  await resubmitAfterLogin()
  expect(get(pendingSolves)).toHaveLength(0)
  expect(first).not.toHaveBeenCalled()
  expect(second).not.toHaveBeenCalled()
})

it('keeps an earlier failure separate from a later saved result', async () => {
  let finishFirst: (response: ReturnType<typeof failed>) => void = () => {}
  const firstReply = new Promise<ReturnType<typeof failed>>((resolve) => { finishFirst = resolve })
  const fetchMock = vi.fn().mockReturnValueOnce(firstReply).mockResolvedValueOnce(saved())
    .mockResolvedValue(failed())
  vi.stubGlobal('fetch', fetchMock)
  const { submitSolve, startAttempt, submitStatus, pendingSolves } = await import('./submit')
  const savingFirst = submitSolve({ id: 'post:easy' }, () => {})
  startAttempt()
  const savingSecond = submitSolve({ id: 'post:hard' }, () => {})
  finishFirst(failed())
  await savingSecond
  await vi.runAllTimersAsync()
  await savingFirst
  expect(get(submitStatus)).toBe('saved')
  expect(get(pendingSolves)).toMatchObject([{ puzzleId: 'post:easy', status: 'failed' }])
})

it('still retries a previous login-required solve if a newer solve saves before focus returns', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(loggedOut()).mockResolvedValue(saved())
  vi.stubGlobal('fetch', fetchMock)
  const { submitSolve, startAttempt, pendingSolves, awaitLoginReturn, resubmitAfterLogin } = await import('./submit')
  await submitSolve({ id: 'post:easy' }, () => {})
  startAttempt()
  awaitLoginReturn()
  await submitSolve({ id: 'post:hard' }, () => {})
  await resubmitAfterLogin()
  expect(get(pendingSolves)).toHaveLength(0)
  expect(fetchMock.mock.calls.filter(([url]) => url === '/api/submit')).toHaveLength(3)
})

it('resends login-required solves one at a time', async () => {
  let finishFirst: (response: ReturnType<typeof saved>) => void = () => {}
  const firstRetry = new Promise<ReturnType<typeof saved>>((resolve) => { finishFirst = resolve })
  const fetchMock = vi.fn().mockResolvedValueOnce(loggedOut()).mockResolvedValueOnce(loggedOut())
    .mockReturnValueOnce(firstRetry).mockResolvedValue(saved())
  vi.stubGlobal('fetch', fetchMock)
  const { submitSolve, startAttempt, awaitLoginReturn, resubmitAfterLogin } = await import('./submit')
  await submitSolve({ id: 'post:easy' }, () => {})
  startAttempt()
  await submitSolve({ id: 'post:easy' }, () => {})
  startAttempt()
  awaitLoginReturn()
  const retries = resubmitAfterLogin()
  await vi.advanceTimersByTimeAsync(0)
  expect(fetchMock.mock.calls.filter(([url]) => url === '/api/submit')).toHaveLength(3)
  finishFirst(saved())
  await retries
  expect(fetchMock.mock.calls.filter(([url]) => url === '/api/submit')).toHaveLength(4)
})

it('serializes a new solve behind an earlier in-flight submit without blocking play', async () => {
  let finishFirst: (response: ReturnType<typeof saved>) => void = () => {}
  const firstReply = new Promise<ReturnType<typeof saved>>((resolve) => { finishFirst = resolve })
  const fetchMock = vi.fn().mockReturnValueOnce(firstReply).mockResolvedValue(saved())
  vi.stubGlobal('fetch', fetchMock)
  const { submitSolve, startAttempt, pendingSolves } = await import('./submit')
  const first = submitSolve({ id: 'post:easy' }, () => {})
  startAttempt()
  const second = submitSolve({ id: 'post:easy' }, () => {})
  await Promise.resolve()
  expect(fetchMock.mock.calls.filter(([url]) => url === '/api/submit')).toHaveLength(1)
  finishFirst(saved())
  await Promise.all([first, second])
  expect(fetchMock.mock.calls.filter(([url]) => url === '/api/submit')).toHaveLength(2)
  expect(get(pendingSolves)).toHaveLength(0)
})
