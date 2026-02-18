import { SIZE } from '../rules'
import type { Cell, Grid } from '../types/puzzle'

export const cloneGrid = (grid: Grid): Grid => grid.map((row) => row.slice())

export const createEmptyGrid = (): Grid => {
  const grid: Grid = new Array(SIZE)
  for (let r = 0; r < SIZE; r++) {
    const row = new Array(SIZE)
    for (let c = 0; c < SIZE; c++) {
      row[c] = null
    }
    grid[r] = row
  }
  return grid
}

export const countLine = (line: Cell[]): { zeros: number; ones: number } => {
  let zeros = 0
  let ones = 0
  for (const v of line) {
    if (v === 0) {
      zeros++
    } else if (v === 1) {
      ones++
    }
  }
  return { zeros, ones }
}
