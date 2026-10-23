import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { get } from 'svelte/store'
import { formatJoinLabel, joinCurrentSubreddit } from './join'
import { hasJoinedSubreddit, setHasJoinedSubreddit } from './ui'

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

describe('joinCurrentSubreddit', () => {
  beforeEach(() => {
    setHasJoinedSubreddit(false)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('marks the player as joined', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ ok: true }, 200)))
    vi.stubGlobal('fetch', fetchMock)

    expect(await joinCurrentSubreddit()).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith('/api/join-subreddit', { method: 'POST' })
    expect(get(hasJoinedSubreddit)).toBe(true)
  })

  it('offers a retry when joining fails', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        jsonResponse({ status: 'error', message: 'Failed to join subreddit. Error: boom' }, 400)
      )
    )

    expect(await joinCurrentSubreddit()).toEqual({ ok: false, error: "Couldn't join the subreddit." })
    expect(get(hasJoinedSubreddit)).toBe(false)
  })

  it('asks logged-out players to log in', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(jsonResponse({ status: 'error', message: 'Login required' }, 400))
    )

    expect(await joinCurrentSubreddit()).toEqual({ ok: false, error: 'Log in to Reddit to join.' })
  })

  it('offers a retry when the network fails', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')))

    expect(await joinCurrentSubreddit()).toEqual({ ok: false, error: "Couldn't join the subreddit." })
    expect(get(hasJoinedSubreddit)).toBe(false)
  })
})

describe('formatJoinLabel', () => {
  it('names the subreddit the game is installed in', () => {
    expect(formatJoinLabel('logicpuzzles')).toBe('Join r/logicpuzzles')
  })

  it('stays readable outside Reddit, where there is no subreddit', () => {
    expect(formatJoinLabel(undefined)).toBe('Join this community')
  })
})
