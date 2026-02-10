import { describe, expect, it } from 'vitest'
import { SIZE } from './rules'
import type { Cell, FixedCell, Grid } from './types/puzzle'
import { findForcedMoves, getCellCandidates } from './hints'

const emptyGrid = (): Grid =>
  Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => null as Cell)
  )

describe('getCellCandidates', () => {
  it('returns a single candidate when row count is maxed', () => {
    const grid = emptyGrid()
    grid[0][0] = 0
    grid[0][1] = 0
    grid[0][2] = 0

    const candidates = getCellCandidates(grid, 0, 3, [])
    expect(candidates).toEqual([1])
  })

  it('rejects a candidate that creates a triple run', () => {
    const grid = emptyGrid()
    grid[0][0] = 1
    grid[0][1] = 1

    const candidates = getCellCandidates(grid, 0, 2, [])
    expect(candidates).toEqual([0])
  })

  it('respects column count constraints', () => {
    const grid = emptyGrid()
    grid[0][0] = 1
    grid[1][0] = 1
    grid[2][0] = 1

    const candidates = getCellCandidates(grid, 3, 0, [])
    expect(candidates).toEqual([0])
  })

  it('returns both candidates when both are valid', () => {
    const grid = emptyGrid()
    const candidates = getCellCandidates(grid, 0, 0, [])
    expect(candidates.sort()).toEqual([0, 1])
  })
})

describe('findForcedMoves', () => {
  it('finds forced moves and skips fixed cells', () => {
    const grid = emptyGrid()
    grid[0][0] = 0
    grid[0][1] = 0
    grid[0][2] = 0
    grid[1][0] = 1
    grid[1][1] = 1

    const fixed: FixedCell[] = [{ r: 0, c: 3, v: 1 }]
    grid[0][3] = 1

    const forcedMoves = findForcedMoves(grid, fixed)

    expect(forcedMoves).toEqual(
      expect.arrayContaining([
        { r: 1, c: 2, value: 0 },
        { r: 0, c: 4, value: 1 }
      ])
    )

    const hasFixedCell = forcedMoves.some(
      (move) => move.r === 0 && move.c === 3
    )
    expect(hasFixedCell).toBe(false)
  })
})
