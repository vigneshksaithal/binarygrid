import type { Cell } from '../../shared/types/puzzle'

/** Names that match the glyphs on screen, ○ for 0 and | for 1, wherever a glyph is spoken. */
export const GLYPH_NAMES = { 0: 'circle', 1: 'line' } as const

/**
 * Screen-reader label for a grid cell, such as
 * "Row 2, column 5, line, breaks a rule". Rows and columns count from 1.
 */
export const cellLabel = ({
  row,
  col,
  value,
  fixed,
  breaksRule,
}: {
  row: number
  col: number
  value: Cell
  fixed: boolean
  breaksRule: boolean
}): string => {
  const parts = [`Row ${row + 1}`, `column ${col + 1}`, value === null ? 'empty' : GLYPH_NAMES[value]]
  if (fixed) parts.push('clue')
  if (breaksRule) parts.push('breaks a rule')
  return parts.join(', ')
}
