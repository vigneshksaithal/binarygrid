import { Hono } from 'hono'
import { baselineRoutes } from './baseline'
import { dailyPostRoutes } from './daily-post'
import growthRoutes from './growth'
import leaderboardRoutes from './leaderboard'
import puzzleRoutes from './puzzle'
import shareRoutes from './share'
import submitRoutes from './submit'
import userRoutes from './user'

const app = new Hono()

app.get('/api/health', (c) => c.json({ ok: true }))

app.route('/', puzzleRoutes)
app.route('/', userRoutes)
app.route('/', shareRoutes)
app.route('/', leaderboardRoutes)
app.route('/', submitRoutes)
app.route('/', growthRoutes)
app.route('/', baselineRoutes)
app.route('/', dailyPostRoutes)

export default app
