import { context, reddit } from '@devvit/web/server'
import { Hono } from 'hono'
import { aggregateMetrics } from '../lib/viral-analytics'
import { formatMetricsAsMarkdown } from '../../shared/viral-analytics'
import { HTTP_BAD_REQUEST, HTTP_OK } from './utils'

const app = new Hono()

const HTTP_FORBIDDEN = 403
const DEFAULT_DAYS = 14
const MAX_DAYS = 90

/**
 * Checks whether the current user (from Devvit context) is a moderator of the
 * current subreddit. Returns false on any error or missing context — fail-safe
 * per requirement 6.1.
 */
const checkIsModerator = async (): Promise<boolean> => {
    const { userId, subredditName } = context
    if (!userId || !subredditName) return false
    try {
        const mods = await (reddit as unknown as {
            getModerators: (opts: { subredditName: string }) => Promise<{ children: Array<{ id: string }> }>
        }).getModerators({ subredditName })
        return mods.children.some((mod) => mod.id === userId)
    } catch {
        return false
    }
}

// GET /api/admin/metrics — moderator-only; returns aggregated viral metrics
app.get('/api/admin/metrics', async (c) => {
    const isMod = await checkIsModerator()
    if (!isMod) {
        return c.json({ error: 'Forbidden: moderator access required' }, HTTP_FORBIDDEN)
    }

    const daysParam = c.req.query('days')
    const days = daysParam ? Number.parseInt(daysParam, 10) : DEFAULT_DAYS

    if (!Number.isInteger(days) || days <= 0) {
        return c.json({ error: 'days must be a positive integer' }, HTTP_BAD_REQUEST)
    }

    try {
        const metrics = await aggregateMetrics(Math.min(days, MAX_DAYS))
        return c.json({ metrics }, HTTP_OK)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return c.json({ error: `Failed to fetch metrics: ${message}` }, HTTP_BAD_REQUEST)
    }
})

// GET /api/admin/metrics/export — moderator-only; returns metrics as markdown
app.get('/api/admin/metrics/export', async (c) => {
    const isMod = await checkIsModerator()
    if (!isMod) {
        return c.json({ error: 'Forbidden: moderator access required' }, HTTP_FORBIDDEN)
    }

    const daysParam = c.req.query('days')
    const days = daysParam ? Number.parseInt(daysParam, 10) : DEFAULT_DAYS

    if (!Number.isInteger(days) || days <= 0) {
        return c.json({ error: 'days must be a positive integer' }, HTTP_BAD_REQUEST)
    }

    try {
        const metrics = await aggregateMetrics(Math.min(days, MAX_DAYS))
        const markdown = formatMetricsAsMarkdown(metrics)
        return c.json({ markdown }, HTTP_OK)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return c.json({ error: `Failed to export metrics: ${message}` }, HTTP_BAD_REQUEST)
    }
})

export default app
