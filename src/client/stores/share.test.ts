import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { get } from 'svelte/store'
import type { ScoreShareRequest } from '../../shared/share-formatter'
import {
  buildScoreShareRequest,
  describeShareDestination,
  resetAllShareState,
  shareState,
  shareToReddit,
} from './share'

const request: ScoreShareRequest = {
  dayNumber: 128,
  solveTimeSeconds: 134,
  difficulty: 'medium',
  streak: 5,
  templateId: 'beat_time',
}

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const stubFetch = (response: () => Promise<Response>) => {
  const fetchMock = vi.fn(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('shareToReddit', () => {
  beforeEach(() => {
    resetAllShareState()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends exactly the request the player previewed', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(jsonResponse({ ok: true }, 200)))

    expect(await shareToReddit(request)).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/api/share-score', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    })
    expect(get(shareState)).toMatchObject({
      isSharing: false,
      shareSuccess: true,
      shareError: null,
    })
  })

  it('offers a retry when the comment fails', async () => {
    stubFetch(() =>
      Promise.resolve(
        jsonResponse({ ok: false, error: 'Failed to post share comment: rate limited' }, 400)
      )
    )

    expect(await shareToReddit(request)).toBe(false)
    expect(get(shareState)).toMatchObject({
      isSharing: false,
      shareSuccess: false,
      shareError: "Couldn't post your comment.",
    })
  })

  it('asks logged-out players to log in', async () => {
    stubFetch(() => Promise.resolve(jsonResponse({ ok: false, error: 'login required' }, 400)))

    expect(await shareToReddit(request)).toBe(false)
    expect(get(shareState).shareError).toBe('Log in to Reddit to comment your score.')
  })

  it('offers a retry when the network fails', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')))

    expect(await shareToReddit(request)).toBe(false)
    expect(get(shareState)).toMatchObject({
      isSharing: false,
      shareError: "Couldn't post your comment.",
    })
  })
})

describe('buildScoreShareRequest', () => {
  const draft = {
    dayNumber: 128,
    solveTimeSeconds: 134,
    difficulty: 'medium',
    streak: 5,
    customText: '',
  } as const

  it("adds today's template line", () => {
    expect(buildScoreShareRequest(draft)).toEqual({ ...draft, templateId: 'beat_time' })
  })
})

describe('describeShareDestination', () => {
  it('names the score thread and the account for a generic score', () => {
    expect(describeShareDestination('scoreThread', 'grid_fan')).toBe(
      "Reply in today's score thread as u/grid_fan"
    )
  })

  it('names the post when the player adds their own words', () => {
    expect(describeShareDestination('customTopLevel', 'grid_fan')).toBe(
      'Comment on this post as u/grid_fan'
    )
  })

  it('still says who posts when the username is unknown', () => {
    expect(describeShareDestination('scoreThread', undefined)).toBe(
      "Reply in today's score thread from your account"
    )
  })
})
