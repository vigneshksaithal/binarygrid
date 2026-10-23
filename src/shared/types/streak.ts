import type { PlayerTitle } from './economy'

/** A number a spent freeze covered, and its post's UTC date. */
export type CoveredNumber = { number: number; date: string }

/** An earlier number the player can still solve for their streak, and when its window closes. */
export type StillCounts = { number: number; postId: string; closesAt: string }

/** What the puzzle rule adds to a streak. Calendar-rule responses carry none of it. */
export type PuzzleStreakDetails = {
  rule: 'puzzle'
  freezes: number
  /** The run that ended before this solve or read; 0 while a run is alive. */
  endedRun: number
  /** Numbers this solve's freezes covered; empty on reads. */
  covered: CoveredNumber[]
  stillCounts: StillCounts | null
}

export type StreakData = {
  currentStreak: number
  longestStreak: number
  todayCompleted: boolean
} & Partial<PuzzleStreakDetails>

export type StreakLeaderboardEntry = {
  userId: string
  username: string
  avatarUrl: string | null
  streak: number
  rank: number
  title: PlayerTitle | null
}

export type StreakLeaderboardResponse = {
  entries: StreakLeaderboardEntry[]
  totalEntries: number
  playerEntry: StreakLeaderboardEntry | null
}
