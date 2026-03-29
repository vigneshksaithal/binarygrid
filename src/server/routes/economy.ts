import { context } from '@devvit/web/server'
import { Hono } from 'hono'
import { getTitleById } from '../../shared/economy-constants'
import type {
  BuyTitleRequest,
  BuyTitleResponse,
  EquipTitleRequest,
  EquipTitleResponse,
  ShopResponse,
  UserEconomy,
} from '../../shared/types/economy'
import {
  getShopItems,
  getUserEconomy,
  getUserStreakData,
  invalidateDisplayCache,
  saveUserEconomy,
} from '../lib/economy'
import { HTTP_BAD_REQUEST, HTTP_OK } from './utils'

const app = new Hono()

// GET /api/economy — returns UserEconomy for the current user
app.get('/api/economy', async (c) => {
  const { userId } = context
  if (!userId) {
    return c.json({ error: 'login required' }, HTTP_BAD_REQUEST)
  }

  try {
    const economy: UserEconomy = await getUserEconomy(userId)
    return c.json(economy, HTTP_OK)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to fetch economy: ${msg}` }, HTTP_BAD_REQUEST)
  }
})

// GET /api/shop — returns ShopResponse
app.get('/api/shop', async (c) => {
  const { userId } = context
  if (!userId) {
    return c.json({ error: 'login required' }, HTTP_BAD_REQUEST)
  }

  try {
    const [streakData, economy] = await Promise.all([
      getUserStreakData(userId),
      getUserEconomy(userId),
    ])
    const items = await getShopItems(userId, streakData)
    const response: ShopResponse = { items, coins: economy.coins }
    return c.json(response, HTTP_OK)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to fetch shop: ${msg}` }, HTTP_BAD_REQUEST)
  }
})

// POST /api/shop/buy — purchase a title
app.post('/api/shop/buy', async (c) => {
  const { userId } = context
  if (!userId) {
    return c.json<BuyTitleResponse>({ success: false, error: 'login required' }, HTTP_BAD_REQUEST)
  }

  const body = await c.req.json<BuyTitleRequest>().catch(() => null)
  if (!body || typeof body.titleId !== 'string') {
    return c.json<BuyTitleResponse>({ success: false, error: 'invalid payload' }, HTTP_BAD_REQUEST)
  }

  const titleDef = getTitleById(body.titleId)
  if (!titleDef) {
    return c.json<BuyTitleResponse>({ success: false, error: 'title not found' }, HTTP_BAD_REQUEST)
  }

  try {
    const [economy, streakData] = await Promise.all([
      getUserEconomy(userId),
      getUserStreakData(userId),
    ])

    // Check if already owned
    if (economy.ownedTitles.includes(body.titleId)) {
      return c.json<BuyTitleResponse>({ success: false, error: 'already owned' }, HTTP_OK)
    }

    // Check unlock condition
    if (titleDef.condition) {
      const { type, value } = titleDef.condition
      let conditionMet = false
      if (type === 'minSolves') {
        conditionMet = economy.totalSolves >= value
      } else if (type === 'minSpeedSolves') {
        conditionMet = economy.speedSolves >= value
      } else if (type === 'minLongestStreak') {
        conditionMet = streakData.longestStreak >= value
      }
      if (!conditionMet) {
        return c.json<BuyTitleResponse>(
          { success: false, error: 'unlock condition not met' },
          HTTP_OK
        )
      }
    }

    // Check coins
    if (economy.coins < titleDef.cost) {
      return c.json<BuyTitleResponse>(
        { success: false, error: 'insufficient coins' },
        HTTP_OK
      )
    }

    // Deduct coins and add title
    const updated = await saveUserEconomy(userId, {
      coins: economy.coins - titleDef.cost,
      ownedTitles: [...economy.ownedTitles, body.titleId],
    })

    return c.json<BuyTitleResponse>({ success: true, newBalance: updated.coins }, HTTP_OK)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return c.json<BuyTitleResponse>({ success: false, error: `Purchase failed: ${msg}` }, HTTP_BAD_REQUEST)
  }
})

// POST /api/shop/equip — equip a title
app.post('/api/shop/equip', async (c) => {
  const { userId } = context
  if (!userId) {
    return c.json<EquipTitleResponse>({ success: false, error: 'login required' }, HTTP_BAD_REQUEST)
  }

  const body = await c.req.json<EquipTitleRequest>().catch(() => null)
  if (!body || typeof body.titleId !== 'string') {
    return c.json<EquipTitleResponse>({ success: false, error: 'invalid payload' }, HTTP_BAD_REQUEST)
  }

  const titleDef = getTitleById(body.titleId)
  if (!titleDef) {
    return c.json<EquipTitleResponse>({ success: false, error: 'title not found' }, HTTP_BAD_REQUEST)
  }

  try {
    const economy = await getUserEconomy(userId)

    if (!economy.ownedTitles.includes(body.titleId)) {
      return c.json<EquipTitleResponse>({ success: false, error: 'title not owned' }, HTTP_OK)
    }

    await saveUserEconomy(userId, { equippedTitle: body.titleId })
    await invalidateDisplayCache(userId)

    return c.json<EquipTitleResponse>({ success: true }, HTTP_OK)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return c.json<EquipTitleResponse>({ success: false, error: `Equip failed: ${msg}` }, HTTP_BAD_REQUEST)
  }
})

export default app
