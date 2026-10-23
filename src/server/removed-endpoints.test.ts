import { describe, expect, it, vi } from 'vitest'

vi.mock('@devvit/web/server', async () =>
  (await import('./test-helpers/devvit-fake')).createDevvitServerFake()
)
// Importing the server entry starts a server, so keep the handler it would serve instead.
vi.mock('@hono/node-server', () => ({ serve: vi.fn() }))

import { serve } from '@hono/node-server'
import devvitConfig from '../../devvit.json'
import './index'

type Method = 'GET' | 'POST'

const serverFetch = vi.mocked(serve).mock.calls[0]?.[0].fetch

// Every endpoint Reddit can call: menu items, triggers and scheduled tasks.
const configuredEndpoints = new Set<string>([
  ...devvitConfig.menu.items.map((item) => item.endpoint),
  ...Object.values(devvitConfig.triggers),
  ...Object.values(devvitConfig.scheduler.tasks).map((task) => task.endpoint),
])

const callServer = async (method: Method, path: string, body?: unknown): Promise<Response> => {
  if (!serverFetch) throw new Error('the server entry did not start a server')
  const payload =
    body === undefined
      ? {}
      : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
  return serverFetch(new Request(`http://localhost${path}`, { method, ...payload }))
}

// Each was deleted after a needed-by check; the deleting commit's body records it.
const REMOVED_PLATFORM_ENDPOINTS = [
  '/internal/menu/create-weekly-recap',
  '/internal/schedule/weekly-recap',
  '/internal/schedule/refresh-preview',
  '/internal/schedule/ensure-score-thread',
]

const REMOVED_API_ROUTES: Array<[Method, string, unknown]> = [
  ['GET', '/api/user/is-moderator', undefined],
  ['GET', '/api/admin/metrics', undefined],
  ['GET', '/api/admin/metrics/export', undefined],
  ['POST', '/api/viral/impression', { postId: 't3_post_123' }],
  ['POST', '/api/viral/funnel', { event: 'open' }],
  ['POST', '/api/share-comment', { dayNumber: 42, solveTimeSeconds: 92, difficulty: 'medium' }],
]

describe('removed endpoints', () => {
  it.each(REMOVED_PLATFORM_ENDPOINTS)('neither configures nor serves %s', async (endpoint) => {
    const response = await callServer('POST', endpoint)

    expect(configuredEndpoints.has(endpoint)).toBe(false)
    expect(response.status).toBe(404)
  })

  it.each(REMOVED_API_ROUTES)('no longer serves %s %s', async (method, path, body) => {
    const response = await callServer(method, path, body)

    expect(response.status).toBe(404)
  })
})
