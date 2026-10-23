import { get, writable } from 'svelte/store'
import type { SolveQuality } from '../../shared/growth'
import { LOGIN_REQUIRED_CODE } from '../../shared/submit'
import type { StreakData } from '../../shared/types/streak'
import { timeoutSignal } from '../services/request-timeout'
import type { DailyProgress, PlayerContext } from './growth'

/** What the result screen says about the current puzzle's solve. */
export type SubmitStatus = 'idle' | 'saving' | 'saved' | 'failed' | 'login_required'

/** The /api/submit body without its attempt ID, resent unchanged on every retry. */
export type SolvePayload = Record<string, unknown>

/** The parts of a saved solve's response that the result screen shows. */
export type SubmitResponse = {
  ok: true
  rank?: number | null
  totalEntries?: number
  streak?: StreakData
  solveQuality?: SolveQuality
  dailyProgress?: DailyProgress
  playerContext?: PlayerContext
}

export type ShowSubmitResult = (response: SubmitResponse) => void | Promise<void>

type HeldSolve = {
  attemptId: string
  payload: SolvePayload
  showResult: ShowSubmitResult
}

type SendOutcome =
  | { kind: 'saved'; response: SubmitResponse }
  | { kind: 'login_required' }
  | { kind: 'failed' }

// Waits between automatic retries of a failed save; Retry shows after the last.
const RETRY_DELAYS_MS = [1000, 3000, 9000] as const

// A send that hangs this long counts as failed. If the server finished it
// anyway, the retry gets the stored response back.
export const SUBMIT_TIMEOUT_MS = 15_000

export const submitStatus = writable<SubmitStatus>('idle')

// Browsers without crypto.randomUUID get a timestamp and random suffix instead.
const createAttemptId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

let currentAttemptId = createAttemptId()
let heldSolve: HeldSolve | null = null
let awaitingLogin = false

// A save of an earlier attempt finishes quietly, without touching the result screen.
const isCurrent = (solve: HeldSolve): boolean => solve.attemptId === currentAttemptId

const showStatus = (solve: HeldSolve, status: SubmitStatus): void => {
  if (isCurrent(solve)) submitStatus.set(status)
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isSavedResponse = (value: unknown): value is SubmitResponse =>
  isObject(value) && value.ok === true

const isLoginRequired = (value: unknown): boolean =>
  isObject(value) && value.code === LOGIN_REQUIRED_CODE

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const sendSolve = async ({ attemptId, payload }: HeldSolve): Promise<SendOutcome> => {
  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, attemptId }),
      signal: timeoutSignal(SUBMIT_TIMEOUT_MS),
    })
    const data: unknown = await res.json().catch(() => null)
    if (res.ok && isSavedResponse(data)) return { kind: 'saved', response: data }
    if (isLoginRequired(data)) return { kind: 'login_required' }
    return { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}

const showSavedResult = async (solve: HeldSolve, response: SubmitResponse): Promise<void> => {
  if (!isCurrent(solve)) return
  try {
    await solve.showResult(response)
  } catch {
    // The solve is saved; a failed rank or progress lookup only leaves those blank.
  }
}

// Sends the held solve once. True when the outcome is final, false when a retry may help.
const saveOnce = async (solve: HeldSolve): Promise<boolean> => {
  showStatus(solve, 'saving')
  const outcome = await sendSolve(solve)
  if (outcome.kind === 'failed') return false
  if (outcome.kind === 'login_required') {
    showStatus(solve, 'login_required')
    return true
  }
  if (isCurrent(solve)) awaitingLogin = false
  showStatus(solve, 'saved')
  await showSavedResult(solve, outcome.response)
  return true
}

const saveOrShowFailure = async (solve: HeldSolve): Promise<void> => {
  if (!(await saveOnce(solve))) showStatus(solve, 'failed')
}

const saveWithRetries = async (solve: HeldSolve): Promise<void> => {
  if (await saveOnce(solve)) return
  for (const delayMs of RETRY_DELAYS_MS) {
    await wait(delayMs)
    if (await saveOnce(solve)) return
  }
  showStatus(solve, 'failed')
}

/** Starts the attempt for a freshly loaded puzzle, with a new attempt ID. */
export const startAttempt = (): void => {
  currentAttemptId = createAttemptId()
  heldSolve = null
  awaitingLogin = false
  submitStatus.set('idle')
}

/**
 * Saves the current attempt's solve, once however often it's called. Shows
 * "Saving…" while it retries after 1, 3 and 9 seconds, then "Saved", the
 * login line, or "Couldn't save" with Retry. Retries reuse the attempt ID,
 * so the server records the solve once.
 */
export const submitSolve = async (
  payload: SolvePayload,
  showResult: ShowSubmitResult
): Promise<void> => {
  if (heldSolve) return
  heldSolve = { attemptId: currentAttemptId, payload, showResult }
  await saveWithRetries(heldSolve)
}

/** Resends the held solve once, from "Couldn't save · Retry". */
export const retrySubmit = async (): Promise<void> => {
  if (!heldSolve || get(submitStatus) !== 'failed') return
  await saveOrShowFailure(heldSolve)
}

/** Holds a logged-out solve for resending when the player comes back from the login prompt. */
export const awaitLoginReturn = (): void => {
  awaitingLogin = true
}

/**
 * Resends a logged-out solve after the login prompt, in case the webview
 * survived the login. Does nothing unless the player opened the prompt.
 */
export const resubmitAfterLogin = async (): Promise<void> => {
  if (!heldSolve || !awaitingLogin || get(submitStatus) !== 'login_required') return
  await saveOrShowFailure(heldSolve)
}
