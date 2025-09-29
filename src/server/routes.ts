import { redis } from '@devvit/web/server'
import { Hono } from 'hono'
import type {
    GetPuzzleResponse,
    Grid,
    Puzzle,
    SubmitResponse,
    ValidateResponse
} from '../shared/types/api'
import { getOrCreatePuzzle } from './core/puzzle'
import { validateGrid } from './core/validate'

const app = new Hono()

app.get('/api/puzzle', async (c) => {
    const date = c.req.query('date')
    const difficultyParam = c.req.query('difficulty')
    const difficulty =
        difficultyParam === 'easy' ||
            difficultyParam === 'medium' ||
            difficultyParam === 'hard'
            ? difficultyParam
            : undefined
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !difficulty) {
        return c.json({ error: 'invalid date or difficulty' }, 400)
    }
    const puzzle = await getOrCreatePuzzle(date, difficulty)
    return c.json({ puzzle } satisfies GetPuzzleResponse)
})

app.post('/api/validate', async (c) => {
    const body = await c.req
        .json<{ puzzleId: string; filled: Grid }>()
        .catch(() => null)
    if (
        !body ||
        !Array.isArray(body.filled) ||
        typeof body.puzzleId !== 'string'
    ) {
        return c.json({ error: 'invalid payload' }, 400)
    }
    const [dateISO, difficulty] = body.puzzleId.split(':')
    if (!dateISO || !difficulty) return c.json({ error: 'invalid puzzleId' }, 400)
    const puzzle = await getOrCreatePuzzle(
        dateISO,
        difficulty as Puzzle['difficulty']
    )
    const result = validateGrid(puzzle.clues, body.filled)
    return c.json({ result } satisfies ValidateResponse)
})

app.post('/api/submit', async (c) => {
    const playerId = c.req.header('X-Player-Id')
    if (!playerId || playerId.length < 8)
        return c.json({ error: 'missing or invalid X-Player-Id' }, 400)
    const body = await c.req
        .json<{ puzzleId: string; filled: Grid; solvedAtISO: string }>()
        .catch(() => null)
    if (!body) return c.json({ error: 'invalid payload' }, 400)

    const [dateISO, difficulty] = body.puzzleId.split(':')
    if (!dateISO || !difficulty) return c.json({ error: 'invalid puzzleId' }, 400)
    const puzzle = await getOrCreatePuzzle(
        dateISO,
        difficulty as Puzzle['difficulty']
    )
    const result = validateGrid(puzzle.clues, body.filled)
    if (!result.solved) return c.json({ error: 'grid not solved' }, 400)

    const key = `submission:${body.puzzleId}:${playerId}`
    const existing = await redis.get(key)
    if (existing) {
        return c.json({ ok: true, alreadySubmitted: true } satisfies SubmitResponse)
    }

    // Simple rate limit token (10s TTL)
    const tokenKey = `${key}:rl`
    const token = await redis.get(tokenKey)
    if (token) return c.json({ error: 'rate limited' }, 429)
    await redis.set(tokenKey, '1', { ttl: 10 })

    await redis.set(key, JSON.stringify({ solvedAtISO: body.solvedAtISO }), {
        ttl: 60 * 60 * 24 * 30
    })
    return c.json({ ok: true } satisfies SubmitResponse)
})

export default app
