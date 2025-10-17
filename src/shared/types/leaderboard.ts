export type LeaderboardEntry = {
  member: string
  score: number
}

export type LeaderboardResponse = {
  scores: LeaderboardEntry[]
  nextCursor: number | null
}
