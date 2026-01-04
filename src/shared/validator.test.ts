import { describe, expect, it } from 'vitest'
import { SIZE } from './rules'
import type { Cell, FixedCell, Grid } from './types/puzzle'
import { findErrorCells, hasTripleRun, isComplete, validateGrid } from './validator'

const empty = (): Grid =>
  Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => null as Cell)
  )

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
    expect(findErrorCells(g).size).toBe(0)
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

describe('findErrorCells', () => {
  it('identifies cells in triple runs', () => {
    const g = empty()
    // 0, 0, 0 at the start of row 0
    g[0] = [0, 0, 0, null, null, null]
    const errors = findErrorCells(g)
    expect(errors.has('0,0')).toBe(true)
    expect(errors.has('0,1')).toBe(true)
    expect(errors.has('0,2')).toBe(true)
    expect(errors.has('0,3')).toBe(false)
  })

  it('identifies cells in count violations', () => {
    const g = empty()
    // Four 0s in row 1
    g[1] = [0, 0, 0, 0, null, null]
    const errors = findErrorCells(g)
    expect(errors.has('1,0')).toBe(true)
    expect(errors.has('1,1')).toBe(true)
    expect(errors.has('1,2')).toBe(true)
    expect(errors.has('1,3')).toBe(true)
  })

  it('identifies overlapping errors', () => {
    const g = empty()
    // Row 0 has 0,0,0 (triple run)
    g[0] = [0, 0, 0, null, null, null]
    // Col 0 has 0,0,0 (triple run)
    g[1][0] = 0
    g[2][0] = 0

    const errors = findErrorCells(g)
    expect(errors.has('0,0')).toBe(true)
    expect(errors.has('0,1')).toBe(true)
    expect(errors.has('0,2')).toBe(true)
    expect(errors.has('1,0')).toBe(true)
    expect(errors.has('2,0')).toBe(true)
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
