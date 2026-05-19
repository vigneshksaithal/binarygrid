// Challenge System — pure computation functions
// Framework-agnostic; no side-effects. Safe to import from client and server.

import type { ChallengeState } from './viral-types'

export type WinnerResult = {
    winner: 'challenger' | 'opponent'
    margin: number
}

/**
 * Determines the winner of a 1v1 challenge.
 * Lower solve time wins; ties go to the challenger.
 */
export const determineWinner = (
    challengerTime: number,
    opponentTime: number
): WinnerResult => ({
    winner: challengerTime <= opponentTime ? 'challenger' : 'opponent',
    margin: Math.abs(challengerTime - opponentTime),
})

// Valid transitions: pending → active, pending → expired, active → finished, active → expired
const VALID_TRANSITIONS: Record<ChallengeState, Partial<Record<string, ChallengeState>>> = {
    pending: { accept: 'active', expire: 'expired' },
    active: { complete: 'finished', expire: 'expired' },
    finished: {},
    expired: {},
}

/**
 * Returns true if the given action is a valid transition from the current state.
 * Terminal states (finished, expired) reject all actions.
 */
export const isValidTransition = (
    currentState: ChallengeState,
    action: 'accept' | 'complete' | 'expire'
): boolean => Boolean(VALID_TRANSITIONS[currentState]?.[action])

const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/
const MAX_USERNAME_LENGTH = 20

/**
 * Validates a Reddit username: alphanumeric + underscores only, max 20 chars, non-empty.
 */
export const validateUsername = (username: string): boolean =>
    username.length > 0 &&
    username.length <= MAX_USERNAME_LENGTH &&
    USERNAME_PATTERN.test(username)

const MAX_SOLVE_TIME = 3600

/**
 * Validates a puzzle solve time: finite number, >= 0, <= 3600 seconds.
 * A value of 0.0 is explicitly permitted.
 */
export const validateSolveTime = (time: number): boolean =>
    Number.isFinite(time) && time >= 0 && time <= MAX_SOLVE_TIME
