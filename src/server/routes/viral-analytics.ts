import { context } from '@devvit/web/server'
import { Hono } from 'hono'
import { trackFunnelEvent, trackImpression } from '../lib/viral-analytics'
import type { FunnelEvent } from '../../shared/viral-types'
import { HTTP_BAD_REQUEST, HTTP_OK, todayISO } from './utils'

const app = new Hono()

const VALID_FUNNEL_EVENTS: FunnelEvent[] = [
    'impression',
    'open',
    'start',
    'complete',
    'share',
    'refer_open',
]

// POST /api/viral/impression — no auth required
app.post('/api/viral/impression', async (c) => {
    const body = await c.req.json<{ postId: string }>().catch(() => null)
    if (!body || typeof body.postId !== 'string' || !body.postId) {
        return c.json({ error: 'postId is required' }, HTTP_BAD_REQUEST)
    }

    try {
        await trackImpression(body.postId, todayISO())
        return c.json({ ok: true }, HTTP_OK)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return c.json({ error: `Failed to track impression: ${message}` }, HTTP_BAD_REQUEST)
    }
})

// POST /api/viral/funnel — requires auth
app.post('/api/viral/funnel', async (c) => {
    const { userId } = context
    if (!userId) {
        return c.json({ error: 'authentication required' }, HTTP_BAD_REQUEST)
    }

    const body = await c.req.json<{ event: string }>().catch(() => null)
    if (!body || typeof body.event !== 'string') {
        return c.json({ error: 'event is required' }, HTTP_BAD_REQUEST)
    }

    if (!VALID_FUNNEL_EVENTS.includes(body.event as FunnelEvent)) {
        return c.json(
            { error: `Invalid funnel event. Must be one of: ${VALID_FUNNEL_EVENTS.join(', ')}` },
            HTTP_BAD_REQUEST
        )
    }

    try {
        await trackFunnelEvent(body.event as FunnelEvent, todayISO())
        return c.json({ ok: true }, HTTP_OK)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return c.json({ error: `Failed to track funnel event: ${message}` }, HTTP_BAD_REQUEST)
    }
})

export default app
