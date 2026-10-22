import { describe, expect, it } from 'vitest'
import { cellLabel } from './cell-label'

describe('cellLabel', () => {
  it('names the row, column and value, counting from 1', () => {
    expect(cellLabel({ row: 1, col: 4, value: 0, fixed: false, breaksRule: false })).toBe(
      'Row 2, column 5, circle'
    )
  })

  it('names an empty cell', () => {
    expect(cellLabel({ row: 0, col: 0, value: null, fixed: false, breaksRule: false })).toBe(
      'Row 1, column 1, empty'
    )
  })

  it('marks a clue', () => {
    expect(cellLabel({ row: 5, col: 2, value: 1, fixed: true, breaksRule: false })).toBe(
      'Row 6, column 3, line, clue'
    )
  })

  it('says when a marked cell breaks a rule', () => {
    expect(cellLabel({ row: 1, col: 4, value: 1, fixed: false, breaksRule: true })).toBe(
      'Row 2, column 5, line, breaks a rule'
    )
  })
})
