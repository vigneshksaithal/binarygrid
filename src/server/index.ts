import {
  cache,
  context,
  createServer,
  getServerPort,
  reddit,
  redis
} from '@devvit/web/server'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { createPost } from './core/post'
import routes from './routes'

const app = new Hono()
app.route('/', routes)

const HTTP_BAD_REQUEST = 400
const DAILY_POST_TIME_ZONE = 'Asia/Kolkata'
const DAILY_POST_TARGET_HOUR = 21
const DAILY_POST_TARGET_MINUTE = 0
const DAILY_POST_CACHE_KEY = 'daily-puzzle-post:last-posted-date'
const DAILY_POST_EXPECTED_LABEL = `${String(DAILY_POST_TARGET_HOUR).padStart(
  2,
  '0'
)}:${String(DAILY_POST_TARGET_MINUTE).padStart(2, '0')}`

type DailyPostLocalContext = {
  dateKey: string
  hour: number
  minute: number
  timeLabel: string
}

const getDailyPostLocalContext = (date = new Date()): DailyPostLocalContext => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: DAILY_POST_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

  const parts = formatter.formatToParts(date)
  const part = (type: Intl.DateTimeFormatPart['type']) =>
    parts.find((p) => p.type === type)?.value

  const year = part('year')
  const month = part('month')
  const day = part('day')
  const hour = part('hour')
  const minute = part('minute')

  if (!(year && month && day && hour && minute)) {
    throw new Error('Unable to build local time context for scheduler')
  }

  return {
    dateKey: `${year}-${month}-${day}`,
    hour: Number.parseInt(hour, 10),
    minute: Number.parseInt(minute, 10),
    timeLabel: `${hour}:${minute}`
  }
}

app.get('/api/init', async (c) => {
  const { postId } = context

  if (!postId) {
    return c.json(
      {
        status: 'error',
        message: 'postId is required but missing from context'
      },
      HTTP_BAD_REQUEST
    )
  }

  try {
    const puzzle = await cache(
      async () => {
        const puzzleData = await redis.hGetAll(`post:${postId}:puzzle`)

        if (!puzzleData?.id) {
          throw new Error('Puzzle not found for this post')
        }

        return {
          id: puzzleData.id,
          size: Number.parseInt(puzzleData.size || '6', 10),
          difficulty: puzzleData.difficulty ?? null,
          fixed: JSON.parse(puzzleData.fixed || '[]'),
          initial: JSON.parse(puzzleData.initial || '[]')
        }
      },
      {
        key: `post:${postId}:puzzle`,
        ttl: 60 * 60 * 24
      }
    )

    const username = await reddit.getCurrentUsername()

    return c.json({
      type: 'init',
      postId,
      puzzle,
      username: username ?? 'anonymous'
    })
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Puzzle not found for this post'
    ) {
      return c.json(
        {
          status: 'error',
          message: error.message
        },
        HTTP_BAD_REQUEST
      )
    }

    let errorMessage = 'Unknown error during initialization'
    if (error instanceof Error) {
      errorMessage = `Initialization failed: ${error.message}`
    }
    return c.json({ status: 'error', message: errorMessage }, HTTP_BAD_REQUEST)
  }
})

app.post('/internal/on-app-install', async (c) => {
  try {
    const post = await createPost('medium')

    return c.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`
    })
  } catch {
    return c.json(
      {
        status: 'error',
        message: 'Failed to create post'
      },
      HTTP_BAD_REQUEST
    )
  }
})

app.post('/internal/menu/post-create', async (c) => {
  try {
    const post = await createPost('medium')

    return c.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`
    })
  } catch {
    return c.json(
      {
        status: 'error',
        message: 'Failed to create post'
      },
      HTTP_BAD_REQUEST
    )
  }
})

// Scheduler endpoint for daily post creation
app.post('/internal/scheduler/daily-puzzle-post', async (c) => {
  try {
    const now = new Date()
    const { dateKey, hour, minute, timeLabel } = getDailyPostLocalContext(now)

    const isTargetHour =
      hour === DAILY_POST_TARGET_HOUR && minute === DAILY_POST_TARGET_MINUTE

    if (!isTargetHour) {
      return c.json({
        status: 'skipped',
        reason: `Current local time ${timeLabel} is outside the ${DAILY_POST_EXPECTED_LABEL} window`,
        localTimeZone: DAILY_POST_TIME_ZONE
      })
    }

    const lastPostDate = await redis.get(DAILY_POST_CACHE_KEY)
    if (lastPostDate === dateKey) {
      return c.json({
        status: 'skipped',
        reason: 'Daily puzzle already published for this date',
        localDate: dateKey
      })
    }

    // Create a new post with a medium difficulty puzzle
    const post = await createPost('medium')
    await redis.set(DAILY_POST_CACHE_KEY, dateKey)

    return c.json({
      status: 'ok',
      postId: post.id,
      localDate: dateKey
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    return c.json(
      {
        status: 'error',
        message: `Failed to create daily puzzle post: ${errorMessage}`
      },
      HTTP_BAD_REQUEST
    )
  }
})

// Start the Devvit-wrapped server so context (reddit, redis, etc.) is available
serve({ fetch: app.fetch, port: getServerPort(), createServer })
