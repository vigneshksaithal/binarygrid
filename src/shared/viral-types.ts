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
    funnel: FunnelMetrics
}
