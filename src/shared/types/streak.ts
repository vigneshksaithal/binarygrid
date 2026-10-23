import type { PlayerTitle } from './economy'

export type StreakData = {
  currentStreak: number
  longestStreak: number
  todayCompleted: boolean
}

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
