import {
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
    const [count, username] = await Promise.all([
      redis.get('count'),
      reddit.getCurrentUsername()
    ])

    return c.json({
      type: 'init',
      postId,
      count: count ? Number.parseInt(count, 10) : 0,
      username: username ?? 'anonymous'
    })
  } catch (error) {
    let errorMessage = 'Unknown error during initialization'
    if (error instanceof Error) {
      errorMessage = `Initialization failed: ${error.message}`
    }
    return c.json({ status: 'error', message: errorMessage }, HTTP_BAD_REQUEST)
  }
})

app.post('/internal/on-app-install', async (c) => {
  try {
    const post = await createPost()

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
    const post = await createPost()

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

// Start the Devvit-wrapped server so context (reddit, redis, etc.) is available
serve({ fetch: app.fetch, port: getServerPort(), createServer })
