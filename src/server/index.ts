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
app.post('/internal/schedule/daily', async (c) => {
  try {
    // Create a new post with a medium difficulty puzzle
    const post = await createPost('easy')

    return c.json({
      status: 'ok',
      postId: post.id
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
