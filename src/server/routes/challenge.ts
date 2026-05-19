import { context, redis } from '@devvit/web/server'
import { Hono } from 'hono'
import {
    acceptChallenge,
    completeChallenge,
    createChallenge,
    getChallengeStatus,
    getPendingChallenges,
} from '../lib/challenge'
import { validateSolveTime, validateUsername } from '../../shared/challenge-logic'
import { HTTP_BAD_REQUEST, HTTP_OK } from './utils'

const HTTP_NOT_FOUND = 404

const app = new Hono()

// POST /api/challenge/create
app.post('/api/challenge/create', async (c) => {
    const { userId } = context
    if (!userId) return c.json({ error: 'authentication required' }, HTTP_BAD_REQUEST)

    const body = await c.req.json<{ opponentUsername: string; puzzleId: string }>().catch(() => null)
    if (!body) return c.json({ error: 'invalid payload' }, HTTP_BAD_REQUEST)

    if (!validateUsername(body.opponentUsername)) {
        return c.json(
            { error: 'Invalid username: alphanumeric and underscores only, max 20 characters' },
            HTTP_BAD_REQUEST
        )
    }
    if (!body.puzzleId || typeof body.puzzleId !== 'string') {
        return c.json({ error: 'puzzleId is required' }, HTTP_BAD_REQUEST)
    }

    try {
        const challenge = await createChallenge(userId, body.opponentUsername, body.puzzleId)
        return c.json(challenge, HTTP_OK)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        if (message.includes('not found')) return c.json({ error: message }, HTTP_NOT_FOUND)
        return c.json({ error: message }, HTTP_BAD_REQUEST)
    }
})

// POST /api/challenge/accept
app.post('/api/challenge/accept', async (c) => {
    const { userId } = context
    if (!userId) return c.json({ error: 'authentication required' }, HTTP_BAD_REQUEST)

    const body = await c.req.json<{ challengeId: string }>().catch(() => null)
    if (!body || !body.challengeId) return c.json({ error: 'challengeId is required' }, HTTP_BAD_REQUEST)

    try {
        const challenge = await acceptChallenge(body.challengeId, userId)
        return c.json(challenge, HTTP_OK)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return c.json({ error: message }, HTTP_BAD_REQUEST)
    }
})

// GET /api/challenge/pending — registered before /:id routes to avoid param capture
app.get('/api/challenge/pending', async (c) => {
    const { userId } = context
    if (!userId) return c.json({ error: 'authentication required' }, HTTP_BAD_REQUEST)

    try {
        const challenges = await getPendingChallenges(userId)
        return c.json({ challenges }, HTTP_OK)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return c.json({ error: message }, HTTP_BAD_REQUEST)
    }
})

// GET /api/challenge/history — registered before /:id routes to avoid param capture
app.get('/api/challenge/history', async (c) => {
    const { userId } = context
    if (!userId) return c.json({ error: 'authentication required' }, HTTP_BAD_REQUEST)

    try {
        const historyRaw = await (
            redis as unknown as { lRange: (key: string, start: number, stop: number) => Promise<string[]> }
        ).lRange(`user:${userId}:challenges:history`, 0, -1)
        const history = historyRaw.map((entry) => JSON.parse(entry))
        return c.json({ history }, HTTP_OK)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return c.json({ error: message }, HTTP_BAD_REQUEST)
    }
})

// POST /api/challenge/:id/complete
app.post('/api/challenge/:id/complete', async (c) => {
    const { userId } = context
    if (!userId) return c.json({ error: 'authentication required' }, HTTP_BAD_REQUEST)

    const challengeId = c.req.param('id')
    const body = await c.req.json<{ solveTime: number }>().catch(() => null)
    if (!body || typeof body.solveTime !== 'number') {
        return c.json({ error: 'solveTime is required' }, HTTP_BAD_REQUEST)
    }
    if (!validateSolveTime(body.solveTime)) {
        return c.json(
            { error: 'solveTime must be a finite number between 0 and 3600 seconds' },
            HTTP_BAD_REQUEST
        )
    }

    try {
        const result = await completeChallenge(challengeId, userId, body.solveTime)
        return c.json(result, HTTP_OK)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return c.json({ error: message }, HTTP_BAD_REQUEST)
    }
})

// GET /api/challenge/:id/status
app.get('/api/challenge/:id/status', async (c) => {
    const { userId } = context
    if (!userId) return c.json({ error: 'authentication required' }, HTTP_BAD_REQUEST)

    const challengeId = c.req.param('id')
    try {
        const status = await getChallengeStatus(challengeId)
        return c.json(status, HTTP_OK)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return c.json({ error: message }, HTTP_BAD_REQUEST)
    }
})

export default app
