import { context, redis } from '@devvit/web/server'
import { Hono } from 'hono'
import { DECIMAL_RADIX } from './utils'

const app = new Hono()

app.get('/api/play-count', async (c) => {
  try {
    const { postId } = context
    if (!postId) {
      return c.json({ count: 0 })
    }

    const countStr = await redis.get(`playCount:${postId}`)
    const count = countStr ? Number.parseInt(countStr, DECIMAL_RADIX) : 0

    return c.json({ count: Number.isNaN(count) ? 0 : count })
  } catch {
    return c.json({ count: 0 })
  }
})

app.post('/api/play-count', async (c) => {
  const { postId } = context
  if (!postId) {
    return c.json({ success: false })
  }

  try {
    await redis.incrBy(`playCount:${postId}`, 1)
    return c.json({ success: true })
  } catch {
    return c.json({ success: false })
  }
})

export default app
