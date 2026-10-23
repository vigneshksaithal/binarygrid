import { setHasJoinedSubreddit } from './ui'

export type JoinResult = { ok: true } | { ok: false; error: string }

export const JOIN_FAILED_MESSAGE = "Couldn't join the subreddit."
export const JOIN_LOGIN_MESSAGE = 'Log in to Reddit to join.'

// The message /api/join-subreddit returns for a logged-out player (src/server/routes/user.ts)
const JOIN_LOGIN_REQUIRED = 'Login required'

const readJoinError = async (res: Response): Promise<string> => {
  const data: unknown = await res.json().catch(() => null)
  const isLoginRequired =
    typeof data === 'object' && data !== null && 'message' in data && data.message === JOIN_LOGIN_REQUIRED
  return isLoginRequired ? JOIN_LOGIN_MESSAGE : JOIN_FAILED_MESSAGE
}

/**
 * Subscribes the player to the subreddit the game runs in.
 */
export const joinCurrentSubreddit = async (): Promise<JoinResult> => {
  try {
    const res = await fetch('/api/join-subreddit', { method: 'POST' })
    if (!res.ok) return { ok: false, error: await readJoinError(res) }

    setHasJoinedSubreddit(true)
    return { ok: true }
  } catch {
    return { ok: false, error: JOIN_FAILED_MESSAGE }
  }
}

// The subreddit name is missing only outside Reddit (local `vite dev`)
export const formatJoinLabel = (subredditName: string | undefined): string =>
  subredditName ? `Join r/${subredditName}` : 'Join this community'
