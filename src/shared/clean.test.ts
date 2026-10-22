import { describe, expect, it } from 'vitest'
import { chargedCells, chargeTap, standingCharges } from './clean'
import type { Cell, Grid } from './types/puzzle'
import { findViolations } from './validator'

const CELL_BY_CHAR: Partial<Record<string, Cell>> = { '0': 0, '1': 1 }

// Reads one string per row: '0' and '1' are digits, anything else is empty.
const parseGrid = (rows: string[]): Grid =>
  rows.map((row) => Array.from(row, (char) => CELL_BY_CHAR[char] ?? null))

const withCell = (grid: Grid, r: number, c: number, value: Cell): Grid =>
  grid.map((row, i) => row.map((cell, j) => (i === r && j === c ? value : cell)))

const idsOf = (grid: Grid): Set<string> =>
  new Set(findViolations(grid).map((violation) => violation.id))

// Row 0 holds ○○○ in columns 0 to 2, so it breaks the no-three-in-a-row rule.
const TRIPLE = parseGrid(['000...', '......', '......', '......', '......', '......'])
const TRIPLE_CELLS = ['0,0', '0,1', '0,2']

// Row 0 holds four ○, so it breaks the three-of-each rule without a triple.
const FOUR_ZEROS = parseGrid(['0.0.00', '......', '......', '......', '......', '......'])

const NOTHING_CHARGED: ReadonlySet<string> = new Set()

describe('chargeTap', () => {
  it('charges nothing for a tap that breaks no rule', () => {
    const after = parseGrid(['0.....', '......', '......', '......', '......', '......'])
    const before = withCell(after, 0, 0, null)
    expect(chargeTap({ before, after, tappedCell: '0,0', charged: NOTHING_CHARGED })).toEqual({
      charged: new Set(),
      mistakes: 0,
    })
  })

  it('leaves a violation the tap just created uncharged until the next tap', () => {
    const before = withCell(TRIPLE, 0, 2, null)
    expect(
      chargeTap({ before, after: TRIPLE, tappedCell: '0,2', charged: NOTHING_CHARGED })
    ).toEqual({ charged: new Set(), mistakes: 0 })
  })

  it('charges one mistake when a tap outside a violation leaves it standing', () => {
    const after = withCell(TRIPLE, 5, 5, 0)
    const result = chargeTap({ before: TRIPLE, after, tappedCell: '5,5', charged: NOTHING_CHARGED })

    expect(result.mistakes).toBe(1)
    expect(chargedCells(after, result.charged)).toEqual(new Set(TRIPLE_CELLS))
  })

  it('charges a violation left standing only once', () => {
    const charged = idsOf(TRIPLE)
    const after = withCell(TRIPLE, 5, 5, 0)

    expect(chargeTap({ before: TRIPLE, after, tappedCell: '5,5', charged })).toEqual({
      charged,
      mistakes: 0,
    })
  })

  it.each(TRIPLE_CELLS)('lets a tap on %s that fixes the triple go free', (tappedCell) => {
    const [r = 0, c = 0] = tappedCell.split(',').map(Number)
    const after = withCell(TRIPLE, r, c, 1)

    expect(chargeTap({ before: TRIPLE, after, tappedCell, charged: NOTHING_CHARGED })).toEqual({
      charged: new Set(),
      mistakes: 0,
    })
  })

  it('drops a charged violation once a tap fixes it', () => {
    const after = withCell(TRIPLE, 0, 0, 1)
    expect(chargeTap({ before: TRIPLE, after, tappedCell: '0,0', charged: idsOf(TRIPLE) })).toEqual({
      charged: new Set(),
      mistakes: 0,
    })
  })

  it('charges a line with too many of one digit when left, not when fixed', () => {
    const left = chargeTap({
      before: FOUR_ZEROS,
      after: withCell(FOUR_ZEROS, 5, 5, 0),
      tappedCell: '5,5',
      charged: NOTHING_CHARGED,
    })
    const fixed = chargeTap({
      before: FOUR_ZEROS,
      after: withCell(FOUR_ZEROS, 0, 4, 1),
      tappedCell: '0,4',
      charged: NOTHING_CHARGED,
    })

    expect(left.mistakes).toBe(1)
    expect(fixed).toEqual({ charged: new Set(), mistakes: 0 })
  })

  it('charges a violation when the tap lands outside its cells, even in the same line', () => {
    // (0,1) was empty, so it was not one of the cells breaking the rule.
    const result = chargeTap({
      before: FOUR_ZEROS,
      after: withCell(FOUR_ZEROS, 0, 1, 0),
      tappedCell: '0,1',
      charged: NOTHING_CHARGED,
    })
    expect(result.mistakes).toBe(1)
  })

  it('charges each violation a tap leaves standing', () => {
    const twoTriples = parseGrid(['000...', '.....1', '.....1', '.....1', '......', '......'])
    const result = chargeTap({
      before: twoTriples,
      after: withCell(twoTriples, 5, 0, 0),
      tappedCell: '5,0',
      charged: NOTHING_CHARGED,
    })
    expect(result.mistakes).toBe(2)
  })
})

describe('standingCharges', () => {
  it('keeps charges that still stand and drops fixed ones', () => {
    const charged = idsOf(FOUR_ZEROS)
    expect(standingCharges(FOUR_ZEROS, charged)).toEqual(charged)
    expect(standingCharges(withCell(FOUR_ZEROS, 0, 0, 1), charged)).toEqual(new Set())
  })
})

describe('chargedCells', () => {
  it('marks only the cells of charged violations', () => {
    const tripleAndFour = parseGrid(['000...', '......', '1.....', '1.....', '1.....', '1.....'])
    expect(chargedCells(tripleAndFour, idsOf(TRIPLE))).toEqual(new Set(TRIPLE_CELLS))
  })
})
