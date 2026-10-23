import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@devvit/web/server', async () =>
  (await import('./test-helpers/devvit-fake')).createDevvitServerFake()
)
// Importing the server entry starts a server, so keep the handler it would serve instead.
vi.mock('@hono/node-server', () => ({ serve: vi.fn() }))

import { serve } from '@hono/node-server'
import './index'

type Method = 'GET' | 'POST'

const serverFetch = vi.mocked(serve).mock.calls[0]?.[0].fetch

const callServer = async (method: Method, path: string, body?: unknown): Promise<Response> => {
  if (!serverFetch) throw new Error('the server entry did not start a server')
  const payload =
    body === undefined
      ? {}
      : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
  return serverFetch(new Request(`http://localhost${path}`, { method, ...payload }))
}

// Deleted after a needed-by check found no caller (see the task 11 handoff).
const REMOVED_API_ROUTES: Array<[Method, string, unknown]> = [
  ['GET', '/api/user/is-moderator', undefined],
  ['GET', '/api/admin/metrics', undefined],
  ['GET', '/api/admin/metrics/export', undefined],
  ['POST', '/api/viral/impression', { postId: 't3_post_123' }],
  ['POST', '/api/viral/funnel', { event: 'open' }],
]

describe('removed endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(REMOVED_API_ROUTES)('no longer serves %s %s', async (method, path, body) => {
    const response = await callServer(method, path, body)

    expect(response.status).toBe(404)
  })
})
