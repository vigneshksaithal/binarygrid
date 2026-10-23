import { DAILY_DIFFICULTIES, SOLVE_QUALITY_DEFINITIONS } from '../../shared/growth'
import type { DailyProgress, PlayerContext } from '../stores/growth'

// The result screen's lines that fill in after it opens, once the solve is
// saved. Each holds the room of its longest text from the start
// (ReservedText.svelte), so the buttons below them never move.

/** Every definition the label's line can show. */
export const DEFINITION_RESERVES: readonly string[] = Object.values(SOLVE_QUALITY_DEFINITIONS)

/** The longest "Faster than" line: the top percentile and a gap under 10,000 s. */
export const FASTER_LINE_RESERVES: readonly string[] = [
  'Faster than 100% today · 9999s from next rank',
]

/** The longest progress line: every tier, the longer badge and the most freezes (two). */
export const PROGRESS_LINE_RESERVES: readonly string[] = [
  '3/3 difficulties today · Trio Complete · 2 freezes',
]

/**
 * Room for task 6's freeze message, from its spec's example with the longest
 * weekday. Task 6 fills the line; keep this at least as long as its longest message.
 */
export const FREEZE_MESSAGE_RESERVES: readonly string[] = [
  '❄️ A freeze covered Wednesday. 365-day streak safe.',
]

export const formatFasterLine = (playerContext: PlayerContext | null): string | null => {
  if (!playerContext) return null
  const { fasterThanPercentile, nextRankSeconds } = playerContext
  const gap = nextRankSeconds === null ? '' : ` · ${nextRankSeconds}s from next rank`
  return `Faster than ${fasterThanPercentile}% today${gap}`
}

const trioBadge = ({ perfectDay, trioComplete }: DailyProgress['trio']): string => {
  if (perfectDay) return ' · Perfect Day'
  return trioComplete ? ' · Trio Complete' : ''
}

const freezesLeft = (freezes: number): string => {
  if (freezes <= 0) return ''
  return ` · ${freezes} freeze${freezes === 1 ? '' : 's'}`
}

export const formatProgressLine = (dailyProgress: DailyProgress | null): string | null => {
  if (!dailyProgress) return null
  const { trio, streak } = dailyProgress
  const count = `${trio.completedCount}/${DAILY_DIFFICULTIES.length} difficulties today`
  return `${count}${trioBadge(trio)}${freezesLeft(streak.freezes)}`
}
