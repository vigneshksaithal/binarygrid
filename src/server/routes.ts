import { redis } from '@devvit/web/server'
import { Hono } from 'hono'
import type { Difficulty, Grid, PuzzleWithGrid } from '../shared/types/puzzle'
import { validateGrid } from '../shared/validator'
import { generateDailyPuzzle } from './core/generator'

const app = new Hono()

// Simple in-memory cache for generated puzzles within a process
const cache = new Map<string, PuzzleWithGrid>()

const HTTP_BAD_REQUEST = 400
const HTTP_OK = 200
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

app.get('/api/health', (c) => c.json({ ok: true }))

app.get('/api/puzzle', (c) => {
	const date = c.req.query('date')
	const difficultyParam = c.req.query('difficulty')
	const isDifficulty = (v: unknown): v is Difficulty =>
		v === 'easy' || v === 'medium' || v === 'hard'
	if (!(date && DATE_REGEX.test(date) && isDifficulty(difficultyParam))) {
		return c.json({ error: 'invalid date or difficulty' }, HTTP_BAD_REQUEST)
	}
	const id = `${date}:${difficultyParam}`
	const fromCache = cache.get(id)
	if (fromCache) {
		return c.json({ puzzle: fromCache })
	}
	const puzzle = generateDailyPuzzle(date, difficultyParam)
	cache.set(id, puzzle)
	return c.json({ puzzle })
})

app.post('/api/submit', async (c) => {
	const body = await c.req.json<{ id: string; grid: Grid }>().catch(() => null)
	if (!body || typeof body.id !== 'string' || !Array.isArray(body.grid)) {
		return c.json({ error: 'invalid payload' }, HTTP_BAD_REQUEST)
	}
	const puzzle = cache.get(body.id)
	if (!puzzle) {
		return c.json({ error: 'unknown puzzle id' }, HTTP_BAD_REQUEST)
	}

	const result = validateGrid(body.grid, puzzle.fixed)
	if (!result.ok) {
		return c.json({ ok: false, errors: result.errors }, HTTP_OK)
	}

	// Simple submit record per id to avoid spam
	const key = `submission:${body.id}`
	const exists = await redis.get(key)
	if (!exists) {
		await redis.set(key, '1')
	}
	return c.json({ ok: true })
})

export default app
