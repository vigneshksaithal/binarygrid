import { describe, expect, it } from 'vitest'
import { LEGACY_SCORING_VERSION, SCORING_VERSION } from './growth'
import { SIZE } from './rules'
import type { Cell, FixedCell, Grid } from './types/puzzle'
import {
  findErrorCells,
  findViolations,
  hasTripleRun,
  isComplete,
  normalizeScoringVersion,
  parseScoreShareRequest,
  validateGrid
} from './validator'

const empty = (): Grid =>
  Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => null as Cell)
  )

const CELL_BY_CHAR: Partial<Record<string, Cell>> = { '0': 0, '1': 1 }

// Reads one string per row: '0' and '1' are digits, anything else is empty.
const parseGrid = (rows: string[]): Grid =>
  rows.map((row) => Array.from(row, (char) => CELL_BY_CHAR[char] ?? null))

describe('validator', () => {
  it('rejects wrong shape', () => {
    const g = empty().slice(0, 5)
    const res = validateGrid(g as unknown as Grid, [])
    expect(res.ok).toBe(false)
  })

  it('accepts a valid solved grid', () => {
    // Balanced 6x6 matching rules (manually crafted)
    const g: Grid = [
      [0, 0, 1, 1, 0, 1],
      [1, 1, 0, 0, 1, 0],
      [0, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 1, 0],
      [0, 1, 1, 0, 0, 1],
      [1, 0, 0, 1, 1, 0]
    ]
    const res = validateGrid(g, [])
    expect(res.ok).toBe(true)
    expect(isComplete(g)).toBe(true)
  })

  it('rejects triple run in row', () => {
    const g = empty()
    g[0] = [1, 1, 1, null, null, null]
    const res = validateGrid(g, [])
    expect(res.ok).toBe(false)
  })

  it('rejects triple run in column while rows stay valid', () => {
    const g = empty()
    g[0][1] = 0
    g[1][1] = 0
    g[2][1] = 0

    const res = validateGrid(g, [])
    expect(res.ok).toBe(false)
    expect(res.errorLocations).toBeDefined()
    expect(res.errorLocations?.columns).toContain(1)
    expect(res.errorLocations?.rows ?? []).not.toContain(0)
    expect(res.errorLocations?.rows ?? []).not.toContain(1)
    expect(res.errorLocations?.rows ?? []).not.toContain(2)
  })

  it('respects fixed cells', () => {
    const g = empty()
    g[2][2] = 0
    const fixed: FixedCell[] = [{ r: 2, c: 2, v: 1 }]
    const res = validateGrid(g, fixed)
    expect(res.ok).toBe(false)
  })

  it('returns error locations for invalid rows and columns', () => {
    const g = empty()
    // Create a triple run in row 0
    g[0] = [1, 1, 1, null, null, null]
    // Create too many ones in column 0
    g[1][0] = 1
    g[2][0] = 1
    g[3][0] = 1
    g[4][0] = 1

    const res = validateGrid(g, [])
    expect(res.ok).toBe(false)
    expect(res.errorLocations).toBeDefined()
    expect(res.errorLocations?.rows).toContain(0)
    expect(res.errorLocations?.columns).toContain(0)
  })

  it('returns no error locations for valid grid', () => {
    const g: Grid = [
      [0, 0, 1, 1, 0, 1],
      [1, 1, 0, 0, 1, 0],
      [0, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 1, 0],
      [0, 1, 1, 0, 0, 1],
      [1, 0, 0, 1, 1, 0]
    ]
    const res = validateGrid(g, [])
    expect(res.ok).toBe(true)
    expect(res.errorLocations).toBeUndefined()
  })
})

describe('hasTripleRun', () => {
  it('detects triple run at the start', () => {
    expect(hasTripleRun([0, 0, 0, 1, 1, null])).toBe(true)
    expect(hasTripleRun([1, 1, 1, 0, 0, null])).toBe(true)
  })

  it('detects triple run in the middle', () => {
    expect(hasTripleRun([1, 0, 0, 0, 1, null])).toBe(true)
    expect(hasTripleRun([0, 1, 1, 1, 0, null])).toBe(true)
  })

  it('detects triple run at the end', () => {
    expect(hasTripleRun([null, 1, 0, 0, 0, 0])).toBe(true)
    expect(hasTripleRun([null, 0, 1, 1, 1, 1])).toBe(true)
  })

  it('returns false for lines without triple runs', () => {
    expect(hasTripleRun([0, 0, 1, 1, 0, 1])).toBe(false)
    expect(hasTripleRun([1, 0, 1, 0, 1, 0])).toBe(false)
  })

  it('returns false when nulls break potential runs', () => {
    expect(hasTripleRun([0, 0, null, 0, 1, 1])).toBe(false)
    expect(hasTripleRun([1, 1, null, 1, 0, 0])).toBe(false)
  })

  it('returns false for empty line', () => {
    expect(hasTripleRun([null, null, null, null, null, null])).toBe(false)
  })
})

describe('findViolations', () => {
  const cellsOf = (grid: Grid): string[][] =>
    findViolations(grid).map((violation) => violation.cells)

  it('finds nothing on a grid that breaks no rule', () => {
    const solved = parseGrid([
      '001101',
      '110010',
      '010110',
      '101001',
      '011010',
      '100101'
    ])
    expect(findViolations(solved)).toEqual([])
  })

  it('reports three in a row with its three cells', () => {
    const grid = parseGrid(['.000..', '......', '......', '......', '......', '......'])
    expect(cellsOf(grid)).toEqual([['0,1', '0,2', '0,3']])
  })

  it('reports three in a column with its three cells', () => {
    const grid = parseGrid(['......', '..1...', '..1...', '..1...', '......', '......'])
    expect(cellsOf(grid)).toEqual([['1,2', '2,2', '3,2']])
  })

  it('reports a line holding more than three of one digit, marking each of them', () => {
    const grid = parseGrid(['0.0.00', '......', '......', '......', '......', '......'])
    expect(cellsOf(grid)).toEqual([['0,0', '0,2', '0,4', '0,5']])
  })

  it('reports each three-in-a-row window of a longer run as its own violation', () => {
    const grid = parseGrid(['0000..', '......', '......', '......', '......', '......'])
    const violations = findViolations(grid)

    expect(violations.map((violation) => violation.cells)).toEqual([
      ['0,0', '0,1', '0,2'],
      ['0,1', '0,2', '0,3'],
      ['0,0', '0,1', '0,2', '0,3']
    ])
    expect(new Set(violations.map((violation) => violation.id)).size).toBe(3)
  })

  it('keeps a violation id while it stands, whatever else changes', () => {
    const before = parseGrid(['000...', '......', '......', '......', '......', '......'])
    const after = parseGrid(['000...', '1.....', '.1....', '......', '......', '.....0'])

    expect(findViolations(after).map((violation) => violation.id)).toEqual(
      findViolations(before).map((violation) => violation.id)
    )
  })
})

describe('normalizeScoringVersion', () => {
  it('keeps a known scoring version', () => {
    expect(normalizeScoringVersion(SCORING_VERSION)).toBe(SCORING_VERSION)
    expect(normalizeScoringVersion(LEGACY_SCORING_VERSION)).toBe(LEGACY_SCORING_VERSION)
  })

  it('reads a missing version as the legacy version', () => {
    expect(normalizeScoringVersion(undefined)).toBe(LEGACY_SCORING_VERSION)
  })

  it.each([
    ['zero', 0],
    ['a version newer than this build', SCORING_VERSION + 1],
    ['a fraction', 1.5],
    ['a numeric string', '2'],
    ['null', null],
    ['NaN', Number.NaN]
  ])('reads %s as the legacy version, so no unknown version reaches storage', (_, value) => {
    expect(normalizeScoringVersion(value)).toBe(LEGACY_SCORING_VERSION)
  })
})

describe('findErrorCells', () => {
  it('marks every cell of every violation once', () => {
    const grid = parseGrid(['111...', '1.....', '1.....', '......', '......', '......'])
    expect(findErrorCells(grid)).toEqual(
      new Set(['0,0', '0,1', '0,2', '1,0', '2,0'])
    )
  })

  it('marks nothing on a grid that breaks no rule', () => {
    expect(findErrorCells(empty()).size).toBe(0)
  })
})

describe('parseScoreShareRequest', () => {
  const valid = { dayNumber: 128, solveTimeSeconds: 134, difficulty: 'medium' }

  it('accepts a generic score', () => {
    expect(parseScoreShareRequest(valid)).toEqual(valid)
  })

  it('keeps the streak, rank, template and own words', () => {
    const full = { ...valid, streak: 5, rank: 2, templateId: 'beat_time', customText: 'Fun one' }

    expect(parseScoreShareRequest(full)).toEqual(full)
  })

  it('drops fields the share text never uses', () => {
    const parsed = parseScoreShareRequest({
      ...valid,
      mode: 'customTopLevel',
      solveQuality: 'clean',
      grid: [[0, 1]],
    })

    expect(parsed).not.toHaveProperty('mode')
    expect(parsed).not.toHaveProperty('solveQuality')
    expect(parsed).not.toHaveProperty('grid')
  })

  it.each([
    ['a missing body', null],
    ['a body that is not an object', 'score'],
    ['a missing puzzle number', { ...valid, dayNumber: undefined }],
    ['puzzle number zero', { ...valid, dayNumber: 0 }],
    ['a fractional puzzle number', { ...valid, dayNumber: 1.5 }],
    ['a negative time', { ...valid, solveTimeSeconds: -1 }],
    ['a fractional time', { ...valid, solveTimeSeconds: 92.5 }],
    ['a time sent as text', { ...valid, solveTimeSeconds: '92' }],
    ['an unknown difficulty', { ...valid, difficulty: 'extreme' }],
    ['a negative streak', { ...valid, streak: -1 }],
    ['rank zero', { ...valid, rank: 0 }],
    ['an unknown template', { ...valid, templateId: 'humble_brag' }],
    ['own words that are not text', { ...valid, customText: 42 }],
    ['own words over 280 characters', { ...valid, customText: 'a'.repeat(281) }],
  ])('rejects %s', (_label, payload) => {
    expect(parseScoreShareRequest(payload)).toBeNull()
  })

  it('accepts own words up to 280 characters', () => {
    expect(parseScoreShareRequest({ ...valid, customText: 'a'.repeat(280) })).not.toBeNull()
  })

  it('reads back the same request after the client sends it as JSON', () => {
    // The client previews the parsed request and posts it; the server must format the same request
    const parsed = parseScoreShareRequest({
      ...valid,
      streak: 5,
      templateId: 'beat_time',
      customText: ' Fun one ',
    })

    expect(parseScoreShareRequest(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed)
  })
})
