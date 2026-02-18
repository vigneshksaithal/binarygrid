import { Hono } from 'hono'
import leaderboardRoutes from './leaderboard'
import playCountRoutes from './play-count'
import puzzleRoutes from './puzzle'
import shareRoutes from './share'
import submitRoutes from './submit'
import userRoutes from './user'

const app = new Hono()

app.get('/api/health', (c) => c.json({ ok: true }))

app.route('/', puzzleRoutes)
app.route('/', userRoutes)
app.route('/', shareRoutes)
app.route('/', playCountRoutes)
app.route('/', leaderboardRoutes)
app.route('/', submitRoutes)

export default app
