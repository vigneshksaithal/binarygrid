export type LeaderboardEntry = {
  userId: string
  username: string
  avatarUrl: string | null
  timeSeconds: number
  rank: number
}

export type LeaderboardResponse = {
  entries: LeaderboardEntry[]
  totalEntries: number
  page: number
  pageSize: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  playerEntry: LeaderboardEntry | null
  streak?: number | null
  bestStreak?: number | null
}
