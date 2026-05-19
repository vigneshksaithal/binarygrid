// Viral Social Engine — pure computation functions
// Framework-agnostic; deterministic; no side-effects. Safe to import from client and server.

import type { DailyViralMetrics } from './viral-types'

/**
 * Computes share rate as shares divided by DAU.
 * Returns 0 when DAU is 0 to avoid division by zero.
 */
export const computeShareRate = (shares: number, dau: number): number => {
    if (dau === 0) return 0
    return shares / dau
}

/**
 * Computes conversion rate as referred conversions divided by referred opens.
 * Returns 0 when referredOpens is 0 to avoid division by zero.
 */
export const computeConversionRate = (
    referredConversions: number,
    referredOpens: number
): number => {
    if (referredOpens === 0) return 0
    return referredConversions / referredOpens
}

/**
 * Computes the daily K-factor viral coefficient.
 *
 * K = (shares / DAU) × (referred_conversions / referred_opens)
 *
 * A K-factor > 1 indicates viral growth (each user brings more than one new user).
 * Returns 0 when DAU or referredOpens is 0 to prevent division by zero.
 */
export const calculateKFactor = (metrics: {
    dau: number
    shares: number
    referredOpens: number
    referredConversions: number
}): number => {
    if (metrics.dau === 0 || metrics.referredOpens === 0) return 0
    const shareRate = computeShareRate(metrics.shares, metrics.dau)
    const conversionRate = computeConversionRate(metrics.referredConversions, metrics.referredOpens)
    return shareRate * conversionRate
}

const NO_DATA = 'No data available'

/**
 * Formats an array of daily viral metrics as a markdown table with a summary section.
 *
 * Produces:
 * - Header row with columns: Date, DAU, K-Factor, Share Rate, D1 Ret, D7 Ret, Conversions, Challenges
 * - Separator row immediately after the header
 * - One data row per day
 * - Summary section with averages and best-day identification
 *
 * When metrics is empty, each summary field shows "No data available".
 */
export const formatMetricsAsMarkdown = (metrics: DailyViralMetrics[]): string => {
    const header =
        '| Date | DAU | K-Factor | Share Rate | D1 Ret | D7 Ret | Conversions | Challenges |'
    const separator =
        '|------|-----|----------|------------|--------|--------|-------------|------------|'

    const rows = metrics.map(
        (m) =>
            `| ${m.date} | ${m.dau} | ${m.kFactor.toFixed(3)} | ${(m.shareRate * 100).toFixed(1)}% | ${(m.retentionD1 * 100).toFixed(1)}% | ${(m.retentionD7 * 100).toFixed(1)}% | ${m.referredConversions}/${m.referredOpens} | ${m.challengesCompleted}/${m.challengesSent} |`
    )

    const summary = buildSummarySection(metrics)

    return [header, separator, ...rows, ...summary].join('\n')
}

const buildSummarySection = (metrics: DailyViralMetrics[]): string[] => {
    const prefix = ['', '## Summary']

    if (metrics.length === 0) {
        return [
            ...prefix,
            `- **Avg DAU**: ${NO_DATA}`,
            `- **Avg K-Factor**: ${NO_DATA}`,
            `- **Avg Share Rate**: ${NO_DATA}`,
            `- **Total Challenges**: ${NO_DATA}`,
            `- **Best Day (K)**: ${NO_DATA}`,
        ]
    }

    const count = metrics.length
    const avgDau = Math.round(metrics.reduce((s, m) => s + m.dau, 0) / count)
    const avgKFactor = (metrics.reduce((s, m) => s + m.kFactor, 0) / count).toFixed(3)
    const avgShareRate = ((metrics.reduce((s, m) => s + m.shareRate, 0) / count) * 100).toFixed(1)
    const totalChallenges = metrics.reduce((s, m) => s + m.challengesCompleted, 0)
    const bestDay = metrics.reduce((best, m) => (m.kFactor > best.kFactor ? m : best)).date

    return [
        ...prefix,
        `- **Avg DAU**: ${avgDau}`,
        `- **Avg K-Factor**: ${avgKFactor}`,
        `- **Avg Share Rate**: ${avgShareRate}%`,
        `- **Total Challenges**: ${totalChallenges}`,
        `- **Best Day (K)**: ${bestDay}`,
    ]
}
