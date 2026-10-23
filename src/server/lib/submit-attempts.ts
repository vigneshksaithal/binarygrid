import { redis } from '@devvit/web/server'

/** One solve as the client sends it, and resends unchanged on every retry. */
export type SubmitAttempt = {
  puzzleId: string
  userId: string
  attemptId: string
}

export type SubmitAttemptClaim =
  | { kind: 'claimed' }
  | { kind: 'in_progress' }
  | { kind: 'stored'; response: unknown }

/**
 * A claim older than this belongs to a save that died midway: Devvit ends a
 * request after 30 seconds, so a retry may take the attempt over.
 */
export const SUBMIT_CLAIM_LEASE_MS = 60_000

// Long enough for any retry of a daily puzzle, short enough to clean itself up.
const SUBMIT_ATTEMPT_TTL_SECONDS = 48 * 60 * 60
const CLAIM_PREFIX = 'pending:'

// One hash per player and puzzle, one field per attempt ID: first a claim, then the response.
const attemptKey = ({ puzzleId, userId }: SubmitAttempt): string =>
  `submit:attempt:${puzzleId}:${userId}`

const claimValue = (now: number): string => `${CLAIM_PREFIX}${now}`

const isClaim = (value: string): boolean => value.startsWith(CLAIM_PREFIX)

const isFreshClaim = (value: string, now: number): boolean =>
  isClaim(value) && now - Number(value.slice(CLAIM_PREFIX.length)) <= SUBMIT_CLAIM_LEASE_MS

// Each claim restarts the TTL, so the response saved after it keeps the attempt for 48 hours.
const keepClaim = async (attempt: SubmitAttempt): Promise<SubmitAttemptClaim> => {
  await redis.expire(attemptKey(attempt), SUBMIT_ATTEMPT_TTL_SECONDS)
  return { kind: 'claimed' }
}

/**
 * Claims an attempt before its solve is recorded, so a retry of the same
 * attempt never records it twice. A retry gets the stored response, or
 * `in_progress` while the first save may still be running.
 */
export const claimSubmitAttempt = async (
  attempt: SubmitAttempt
): Promise<SubmitAttemptClaim> => {
  const key = attemptKey(attempt)
  const now = Date.now()
  if (await redis.hSetNX(key, attempt.attemptId, claimValue(now))) return keepClaim(attempt)

  // A missing value means a failed save just released its claim; the next retry takes it.
  const existing = await redis.hGet(key, attempt.attemptId)
  if (existing === undefined || isFreshClaim(existing, now)) return { kind: 'in_progress' }
  if (!isClaim(existing)) return { kind: 'stored', response: JSON.parse(existing) }

  await redis.hSet(key, { [attempt.attemptId]: claimValue(now) })
  return keepClaim(attempt)
}

/** Keeps a recorded solve's response, which every repeat of its attempt gets back. */
export const saveSubmitResponse = async (
  attempt: SubmitAttempt,
  response: object
): Promise<void> => {
  await redis.hSet(attemptKey(attempt), { [attempt.attemptId]: JSON.stringify(response) })
}

/** Drops the claim of a save that failed, so a retry can record the solve. */
export const releaseSubmitAttempt = async (attempt: SubmitAttempt): Promise<void> => {
  await redis.hDel(attemptKey(attempt), [attempt.attemptId])
}
