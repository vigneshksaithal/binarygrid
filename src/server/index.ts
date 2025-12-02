import { context, createServer, getServerPort } from '@devvit/web/server'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import {
  createPost,
  crosspostLatestPost,
  TARGET_CROSSPOST_SUBREDDIT
} from './core/post'
import routes from './routes'

const app = new Hono()
app.route('/', routes)

const HTTP_BAD_REQUEST = 400

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

// Scheduler endpoint for daily post creation
app.post('/internal/schedule/daily', async (c) => {
  try {
    const post = await createPost()

    // Crosspost to target subreddit (don't fail daily post if crosspost fails)
    try {
      await crosspostLatestPost(post.id, TARGET_CROSSPOST_SUBREDDIT)
    } catch (crosspostError) {
      // Log error but don't fail the daily post creation
      const errorMessage =
        crosspostError instanceof Error
          ? crosspostError.message
          : 'Unknown error'
      // biome-ignore lint/suspicious/noConsole: we want to log crosspost errors
      console.error(`Failed to crosspost daily post: ${errorMessage}`)
    }

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
