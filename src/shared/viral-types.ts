// Viral Social Engine — shared type definitions
// Framework-agnostic; no side-effects. Safe to import from client and server.

export type FunnelEvent = 'impression' | 'open' | 'start' | 'complete' | 'share' | 'refer_open'

export type FunnelMetrics = {
    impression: number
    open: number
    start: number
    complete: number
    share: number
    referOpen: number
}

export type DailyViralMetrics = {
    date: string
    dau: number
    impressions: number
    shares: number
    shareRate: number
    referredOpens: number
    referredConversions: number
    conversionRate: number
    kFactor: number
    retentionD1: number
    retentionD7: number
    retentionD30: number
    challengesSent: number
    challengesCompleted: number
    funnel: FunnelMetrics
}

export type ChallengeState = 'pending' | 'active' | 'finished' | 'expired'

export type Challenge = {
    id: string
    state: ChallengeState
    challengerId: string
    opponentId: string
    challengerUsername: string
    opponentUsername: string
    puzzleId: string
    createdAt: string
    startedAt?: string
    challengerTime?: number
    opponentTime?: number
    winner?: string
    margin?: number
}

export type ChallengeResult = {
    challengeId: string
    winner: string
    loser: string
    winnerTime: number
    loserTime: number
    margin: number
}

export type ChallengeNotification = {
    challengeId: string
    challengerUsername: string
    puzzleId: string
    createdAt: string
}

export type ActivePlayerSummary = {
    count: number
    recentAvatars: Array<{ userId: string; username: string; avatarUrl: string | null }>
    solvedTodayCount: number
}

export type RecentSolver = {
    userId: string
    username: string
    avatarUrl: string | null
    solveTime: number
    solvedAt: string
}

export type SocialProofData = {
    activePlayers: number
    solvedToday: number
    recentSolvers: RecentSolver[]
    pendingChallenges: number
}

export type ActivityType = 'heartbeat' | 'solving' | 'viewing'
