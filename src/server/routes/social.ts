import { context } from '@devvit/web/server'
import { Hono } from 'hono'
import { getRecentSolvers, getSocialProof, recordHeartbeat } from '../lib/social'
import { HTTP_BAD_REQUEST, HTTP_OK } from './utils'

const app = new Hono()

// GET /api/social/presence — no auth required
app.get('/api/social/presence', async (c) => {
    const { postId, userId } = context
    if (!postId) {
        return c.json({ error: 'postId is required' }, HTTP_BAD_REQUEST)
    }

    try {
        const data = await getSocialProof(postId, userId ?? undefined)
        return c.json(data, HTTP_OK)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return c.json({ error: `Failed to get social proof: ${message}` }, HTTP_BAD_REQUEST)
    }
})

// POST /api/social/heartbeat — requires auth
app.post('/api/social/heartbeat', async (c) => {
    const { postId, userId } = context
    if (!userId) {
        return c.json({ error: 'authentication required' }, HTTP_BAD_REQUEST)
    }
    if (!postId) {
        return c.json({ error: 'postId is required' }, HTTP_BAD_REQUEST)
    }

    try {
        const summary = await recordHeartbeat(postId, userId)
        return c.json(summary, HTTP_OK)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return c.json({ error: `Failed to record heartbeat: ${message}` }, HTTP_BAD_REQUEST)
    }
})

// GET /api/social/recent-solvers — no auth required
app.get('/api/social/recent-solvers', async (c) => {
    const puzzleId = c.req.query('puzzleId') ?? context.postId
    if (!puzzleId) {
        return c.json({ error: 'puzzleId is required' }, HTTP_BAD_REQUEST)
    }

    try {
        const solvers = await getRecentSolvers(puzzleId, 5)
        return c.json({ solvers }, HTTP_OK)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return c.json({ error: `Failed to get recent solvers: ${message}` }, HTTP_BAD_REQUEST)
    }
})

export default app
