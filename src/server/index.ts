import { context, createServer, getServerPort } from '@devvit/web/server'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { createPost } from './core/post'
import routes from './routes'

const app = new Hono()
app.route('/', routes)

const HTTP_BAD_REQUEST = 400

app.post('/internal/on-app-install', async (c) => {
	try {
		const post = await createPost('easy')

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
		const post = await createPost('easy')

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
		await createPost('easy')

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
