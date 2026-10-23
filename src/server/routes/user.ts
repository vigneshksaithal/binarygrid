import { context, reddit, redis } from '@devvit/web/server'
import { Hono } from 'hono'
import { readPuzzleStreak, readStreakSettings } from '../core/puzzle-streak'
import { DECIMAL_RADIX, HTTP_BAD_REQUEST, todayISO } from './utils'

const app = new Hono()

app.get('/api/check-joined-status', async (c) => {
  const { userId } = context
  if (!userId) {
    return c.json({ hasJoined: false })
  }

  try {
    const hasJoined = await redis.get(`user:${userId}:joined_subreddit`)
    return c.json({ hasJoined: hasJoined === '1' })
  } catch {
    return c.json({ hasJoined: false })
  }
})

app.post('/api/join-subreddit', async (c) => {
  const { userId } = context
  if (!userId) {
    return c.json(
      { status: 'error', message: 'Login required' },
      HTTP_BAD_REQUEST
    )
  }

  try {
    await reddit.subscribeToCurrentSubreddit()
    await redis.set(`user:${userId}:joined_subreddit`, '1')
    return c.json({ ok: true })
  } catch (error) {
    return c.json(
      { status: 'error', message: `Failed to join subreddit. Error: ${error}` },
      HTTP_BAD_REQUEST
    )
  }
})

app.get('/api/streak', async (c) => {
  const { userId, postId } = context
  if (!userId) {
    return c.json({ currentStreak: 0, longestStreak: 0, lastPlayedDate: null, todayCompleted: false })
  }

  try {
    // The puzzle rule computes the streak. The calendar rule, unreadable settings
    // or a failed computation return the stored counters as before, so a puzzle
    // rule bug never shows players a reset streak.
    const streakSettings = await readStreakSettings()
    if (streakSettings?.streakRule === 'puzzle') {
      const puzzleStreak = await readPuzzleStreak(
        userId,
        postId,
        new Date(),
        streakSettings.streakWindowHours
      ).catch(() => null)
      if (puzzleStreak) return c.json(puzzleStreak)
    }

    const [currentStr, longestStr, lastDate] = await Promise.all([
      redis.get(`user:${userId}:streak:current`),
      redis.get(`user:${userId}:streak:longest`),
      redis.get(`user:${userId}:streak:lastDate`)
    ])

    const currentStreak = currentStr ? Number.parseInt(currentStr, DECIMAL_RADIX) : 0
    const longestStreak = longestStr ? Number.parseInt(longestStr, DECIMAL_RADIX) : 0
    const todayDate = todayISO()
    const todayCompleted = lastDate === todayDate

    return c.json({
      currentStreak,
      longestStreak,
      lastPlayedDate: lastDate ?? null,
      todayCompleted
    })
  } catch {
    return c.json({ currentStreak: 0, longestStreak: 0, lastPlayedDate: null, todayCompleted: false })
  }
})

export default app
