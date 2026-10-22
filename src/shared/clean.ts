import type { Grid } from './types/puzzle'
import { findViolations } from './validator'

/**
 * The mistake rule behind the solve labels (debate rule N-3 (c), scoring
 * version 2 in ./growth).
 *
 * Taps cycle empty → ○ → |, so a correct | passes through a ○ that may break
 * a rule for one tap. Charging every rule-breaking state made flawless solves
 * read "Comeback". Instead, each tap is judged after it lands:
 * - a violation that still stands when the player taps a cell outside it
 *   costs one mistake, once;
 * - a tap on one of its cells that fixes it is free.
 * Time never charges, so tap speed can't change the label.
 */

export type TapCharge = {
  /** Ids of the charged violations still standing after the tap. */
  charged: Set<string>
  /** Mistakes the tap adds: one per violation it left standing. */
  mistakes: number
}

const standingIds = (grid: Grid): Set<string> =>
  new Set(findViolations(grid).map((violation) => violation.id))

const keepStanding = (charged: ReadonlySet<string>, standing: ReadonlySet<string>): string[] =>
  [...charged].filter((id) => standing.has(id))

/**
 * Judges one tap. `before` and `after` are the grid around the tap, and
 * `tappedCell` is its "r,c" key.
 */
export const chargeTap = ({
  before,
  after,
  tappedCell,
  charged,
}: {
  before: Grid
  after: Grid
  tappedCell: string
  charged: ReadonlySet<string>
}): TapCharge => {
  const standing = standingIds(after)
  const leftStanding = findViolations(before).filter(
    (violation) =>
      !charged.has(violation.id) &&
      standing.has(violation.id) &&
      !violation.cells.includes(tappedCell)
  )

  return {
    charged: new Set([
      ...keepStanding(charged, standing),
      ...leftStanding.map((violation) => violation.id),
    ]),
    mistakes: leftStanding.length,
  }
}

/** Charged violations that still stand on the grid; fixed ones drop out. */
export const standingCharges = (grid: Grid, charged: ReadonlySet<string>): Set<string> =>
  new Set(keepStanding(charged, standingIds(grid)))

/** Cells that keep their ✕ until fixed: those of every charged violation. */
export const chargedCells = (grid: Grid, charged: ReadonlySet<string>): Set<string> =>
  new Set(
    findViolations(grid)
      .filter((violation) => charged.has(violation.id))
      .flatMap((violation) => violation.cells)
  )
