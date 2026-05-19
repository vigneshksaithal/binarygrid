import { Hono } from 'hono'
import adminRoutes from './admin'
import challengeRoutes from './challenge'
import economyRoutes from './economy'
import growthRoutes from './growth'
import leaderboardRoutes from './leaderboard'
import playCountRoutes from './play-count'
import puzzleRoutes from './puzzle'
import shareRoutes from './share'
import socialRoutes from './social'
import submitRoutes from './submit'
import userRoutes from './user'
import viralAnalyticsRoutes from './viral-analytics'

const app = new Hono()

app.get('/api/health', (c) => c.json({ ok: true }))

app.route('/', puzzleRoutes)
app.route('/', userRoutes)
app.route('/', shareRoutes)
app.route('/', playCountRoutes)
app.route('/', leaderboardRoutes)
app.route('/', submitRoutes)
app.route('/', economyRoutes)
app.route('/', growthRoutes)
app.route('/', viralAnalyticsRoutes)
app.route('/', adminRoutes)
app.route('/', socialRoutes)
app.route('/', challengeRoutes)

export default app
