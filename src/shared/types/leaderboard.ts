import type { PlayerTitle } from './economy'

export type LeaderboardEntry = {
  userId: string
  username: string
  avatarUrl: string | null
  timeSeconds: number
  rank: number
  attempts: number
  title: PlayerTitle | null
}

export type LeaderboardResponse = {
  entries: LeaderboardEntry[]
  totalEntries: number
  page: number
  pageSize: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  playerEntry: LeaderboardEntry | null
}
