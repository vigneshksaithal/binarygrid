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

app.get('/api/init', async (c) => {
	const { postId } = context

	if (!postId) {
		console.error('API Init Error: postId not found in devvit context')
		return c.json(
			{
				status: 'error',
				message: 'postId is required but missing from context'
			},
			400
		)
	}

	try {
		const [count, username] = await Promise.all([
			redis.get('count'),
			reddit.getCurrentUsername()
		])

		return c.json({
			type: 'init',
			postId: postId,
			count: count ? parseInt(count, 10) : 0,
			username: username ?? 'anonymous'
		})
	} catch (error) {
		console.error(`API Init Error for post ${postId}:`, error)
		let errorMessage = 'Unknown error during initialization'
		if (error instanceof Error) {
			errorMessage = `Initialization failed: ${error.message}`
		}
		return c.json({ status: 'error', message: errorMessage }, 400)
	}
})

app.get('/api/test', async (c) => {
	await redis.set('count', '67')
	const count = await redis.get('count')

	return c.json({ message: `Hello, world!${count}` })
})

app.post('/internal/on-app-install', async (c) => {
	try {
		const post = await createPost()

		return c.json({
			navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`
		})
	} catch (error) {
		console.error(`Error creating post: ${error}`)
		return c.json(
			{
				status: 'error',
				message: 'Failed to create post'
			},
			400
		)
	}
})

app.post('/internal/menu/post-create', async (c) => {
	try {
		const post = await createPost()

		return c.json({
			navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`
		})
	} catch (error) {
		console.error(`Error creating post: ${error}`)
		return c.json(
			{
				status: 'error',
				message: 'Failed to create post'
			},
			400
		)
	}
})

// Start the Devvit-wrapped server so context (reddit, redis, etc.) is available
serve({ fetch: app.fetch, port: getServerPort(), createServer })
