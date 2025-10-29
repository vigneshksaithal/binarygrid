import { context, reddit, redis } from '@devvit/web/server'
import { Hono } from 'hono'
import type { Difficulty, Grid, PuzzleWithGrid } from '../shared/types/puzzle'
import { validateGrid } from '../shared/validator'
import { generateDailyPuzzle } from './core/generator'

const app = new Hono()

const HTTP_BAD_REQUEST = 400
const HTTP_OK = 200
const DEFAULT_GRID_SIZE = 6
const DECIMAL_RADIX = 10
const GRID_SIZE_TYPE = 6
const DEFAULT_DIFFICULTY: Difficulty = 'medium'
const DIFFICULTY_VALUES = ['easy', 'medium', 'hard']

const isDifficultyValue = (value: string): value is Difficulty =>
	(DIFFICULTY_VALUES as readonly string[]).includes(value)

const resolveDifficulty = (value: string | null): Difficulty => {
	if (!value) {
		return DEFAULT_DIFFICULTY
	}
	const normalized = value.toLowerCase()
	return isDifficultyValue(normalized) ? normalized : DEFAULT_DIFFICULTY
}

const todayISO = (): string => new Date().toISOString().slice(0, 10)

const resolveDate = (value: string | null): string => {
	if (!value) {
		return todayISO()
	}
	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) {
		return todayISO()
	}
	return parsed.toISOString().slice(0, 10)
}

app.get('/api/health', (c) => c.json({ ok: true }))

// Join subreddit
app.post('/api/join-subreddit', async (c) => {
	try {
		await reddit.subscribeToCurrentSubreddit()
	} catch (error) {
		return c.json(
			{ status: 'error', message: `Failed to join subreddit. Error: ${error}` },
			HTTP_BAD_REQUEST
		)
	}
})

// Get puzzle for the current post
app.get('/api/puzzle', async (c) => {
	try {
		const { postId } = context
		let puzzle: PuzzleWithGrid | null = null

		if (postId) {
			const puzzleData = await redis.hGetAll(`post:${postId}:puzzle`)

			if (puzzleData?.id) {
				puzzle = {
					id: puzzleData.id,
					size: Number.parseInt(
						puzzleData.size || DEFAULT_GRID_SIZE.toString(),
						DECIMAL_RADIX
					) as typeof GRID_SIZE_TYPE,
					difficulty: resolveDifficulty(puzzleData.difficulty ?? null),
					fixed: JSON.parse(puzzleData.fixed || '[]'),
					initial: JSON.parse(puzzleData.initial || '[]')
				}
			}
		}

		if (!puzzle) {
			const date = resolveDate(c.req.query('date') ?? null)
			const difficulty = 'easy'
			puzzle = generateDailyPuzzle(date, difficulty)
		}

		return c.json({ puzzle })
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : 'Unknown error'
		return c.json(
			{ error: `Failed to fetch puzzle: ${errorMessage}` },
			HTTP_BAD_REQUEST
		)
	}
})

app.post('/api/submit', async (c) => {
	const body = await c.req.json<{ id: string; grid: Grid }>().catch(() => null)
	if (!body || typeof body.id !== 'string' || !Array.isArray(body.grid)) {
		return c.json({ error: 'invalid payload' }, HTTP_BAD_REQUEST)
	}

	const { postId } = context
	if (!postId) {
		return c.json({ error: 'postId is required' }, HTTP_BAD_REQUEST)
	}

	try {
		// Fetch puzzle from Redis
		const puzzleData = await redis.hGetAll(`post:${postId}:puzzle`)

		if (!puzzleData?.id) {
			return c.json(
				{ error: 'Puzzle not found for this post' },
				HTTP_BAD_REQUEST
			)
		}

		const fixed = JSON.parse(puzzleData.fixed || '[]')
		const result = validateGrid(body.grid, fixed)

		if (!result.ok) {
			return c.json({ ok: false, errors: result.errors }, HTTP_OK)
		}

		// Store submission record for this post
		const key = `submission:${postId}:${body.id}`
		const exists = await redis.get(key)
		if (!exists) {
			await redis.set(key, '1')
		}

		return c.json({ ok: true })
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : 'Unknown error'
		return c.json(
			{ error: `Submission failed: ${errorMessage}` },
			HTTP_BAD_REQUEST
		)
	}
})

export default app
