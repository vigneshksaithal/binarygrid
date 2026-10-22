import { beforeEach, describe, expect, it, vi } from 'vitest'

// A lightweight in-memory Redis with just the calls daily completions make.
const store = vi.hoisted(() => ({
  strings: new Map<string, string>(),
  hashes: new Map<string, Record<string, string>>(),
}))

vi.mock('@devvit/web/server', () => {
  const hashAt = (key: string): Record<string, string> => store.hashes.get(key) ?? {}

  return {
    redis: {
      get: vi.fn(async (key: string) => store.strings.get(key)),
      hGetAll: vi.fn(async (key: string) => ({ ...hashAt(key) })),
      hSet: vi.fn(async (key: string, values: Record<string, string>) => {
        store.hashes.set(key, { ...hashAt(key), ...values })
      }),
      hIncrBy: vi.fn(async (key: string, field: string, value: number) => {
        const next = Number(hashAt(key)[field] ?? 0) + value
        store.hashes.set(key, { ...hashAt(key), [field]: String(next) })
        return next
      }),
      zAdd: vi.fn(async () => {}),
    },
  }
})

import { LEGACY_SCORING_VERSION, SCORING_VERSION } from '../../shared/growth'
import { getUserDailyCompletions, normalizeAndLabelSolve, recordDailyCompletion } from './growth'

const USER_ID = 't2_player'
const DATE = '2026-10-22'
const COMPLETED_KEY = `user:${USER_ID}:daily:${DATE}:completed`

const labelCounts = (version: number) => store.hashes.get(`daily:${DATE}:quality:v${version}`)

const recordSolve = (overrides: Partial<Parameters<typeof recordDailyCompletion>[0]> = {}) =>
  recordDailyCompletion({
    userId: USER_ID,
    dateISOValue: DATE,
    difficulty: 'medium',
    solveTimeSeconds: 120,
    solveQuality: 'clean',
    scoringVersion: SCORING_VERSION,
    ...overrides,
  })

beforeEach(() => {
  store.strings.clear()
  store.hashes.clear()
})

describe('daily completions', () => {
  it('store each completion with the scoring version it was labeled under', async () => {
    await recordSolve()

    expect(JSON.parse(store.hashes.get(COMPLETED_KEY)?.medium ?? '{}')).toEqual({
      solveTimeSeconds: 120,
      solveQuality: 'clean',
      scoringVersion: SCORING_VERSION,
    })
    expect((await getUserDailyCompletions(USER_ID, DATE)).medium?.scoringVersion).toBe(
      SCORING_VERSION
    )
  })

  it('read a completion stored without a version as the legacy version', async () => {
    store.hashes.set(COMPLETED_KEY, {
      easy: JSON.stringify({ solveTimeSeconds: 52, solveQuality: 'clean' }),
    })

    expect((await getUserDailyCompletions(USER_ID, DATE)).easy).toEqual({
      solveTimeSeconds: 52,
      solveQuality: 'clean',
      scoringVersion: LEGACY_SCORING_VERSION,
    })
  })

  it('count each first solve of a tier per day under its label and scoring version', async () => {
    await recordSolve({ difficulty: 'easy', solveQuality: 'clean' })
    await recordSolve({ difficulty: 'medium', solveQuality: 'sharp' })
    await recordSolve({
      difficulty: 'hard',
      solveQuality: 'comeback',
      scoringVersion: LEGACY_SCORING_VERSION,
    })

    expect(labelCounts(SCORING_VERSION)).toEqual({ clean: '1', sharp: '1' })
    expect(labelCounts(LEGACY_SCORING_VERSION)).toEqual({ comeback: '1' })
  })

  it('leave the label counts alone for a replay of a tier already solved today', async () => {
    await recordSolve({ solveTimeSeconds: 120, solveQuality: 'clean' })
    await recordSolve({ solveTimeSeconds: 90, solveQuality: 'sharp' })

    expect(labelCounts(SCORING_VERSION)).toEqual({ clean: '1' })
    expect((await getUserDailyCompletions(USER_ID, DATE)).medium?.solveQuality).toBe('sharp')
  })
})

describe('normalizeAndLabelSolve', () => {
  it('labels a solve and keeps the scoring version the client sent', () => {
    expect(
      normalizeAndLabelSolve({
        hintsUsed: 0,
        mistakeCount: 0,
        undoCount: 0,
        scoringVersion: SCORING_VERSION,
      })
    ).toMatchObject({ solveQuality: 'clean', scoringVersion: SCORING_VERSION })
  })

  it('reads a solve sent without a version as scored by the legacy rule', () => {
    expect(normalizeAndLabelSolve({ mistakeCount: 2 })).toMatchObject({
      solveQuality: 'comeback',
      scoringVersion: LEGACY_SCORING_VERSION,
    })
  })
})
