import { redis } from '@devvit/web/server'
import { Hono } from 'hono'
import type { Difficulty, Grid, PuzzleWithGrid } from '../shared/types/puzzle'
import { validateGrid } from '../shared/validator'
import { generateDailyPuzzle } from './core/generator'

const app = new Hono()

// Simple in-memory cache for generated puzzles within a process
const cache = new Map<string, PuzzleWithGrid>()

app.get('/api/health', (c) => c.json({ ok: true }))

app.get('/api/puzzle', async (c) => {
	const date = c.req.query('date')
	const difficultyParam = c.req.query('difficulty')
	const isDifficulty = (v: unknown): v is Difficulty =>
		v === 'easy' || v === 'medium' || v === 'hard'
	if (
		!(date && /^\d{4}-\d{2}-\d{2}$/.test(date) && isDifficulty(difficultyParam))
	) {
		return c.json({ error: 'invalid date or difficulty' }, 400)
	}
	const id = `${date}:${difficultyParam}`
	const fromCache = cache.get(id)
	if (fromCache) return c.json({ puzzle: fromCache })
	const puzzle = generateDailyPuzzle(date, difficultyParam)
	cache.set(id, puzzle)
	return c.json({ puzzle })
})

app.post('/api/submit', async (c) => {
	const body = await c.req.json<{ id: string; grid: Grid }>().catch(() => null)
	if (!body || typeof body.id !== 'string' || !Array.isArray(body.grid)) {
		return c.json({ error: 'invalid payload' }, 400)
	}
	const puzzle = cache.get(body.id)
	if (!puzzle) return c.json({ error: 'unknown puzzle id' }, 400)

	const result = validateGrid(body.grid, puzzle.fixed)
	if (!result.ok) return c.json({ ok: false, errors: result.errors }, 200)

	// Simple submit record per id to avoid spam
	const key = `submission:${body.id}`
	const exists = await redis.get(key)
	if (!exists) await redis.set(key, '1')
	return c.json({ ok: true })
})

export default app
