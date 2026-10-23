import { context, reddit, redis } from '@devvit/web/server'
import { toISODate } from '../../shared/baseline'
import { generatePuzzleForDate, generatePuzzleForPost } from './generator'
import { readPostPuzzle, storePostPuzzle } from './post-puzzle'
import { getOrCreateDateNumber, readPostStamp, stampPost } from './puzzle-number'
import { getOrCreatePuzzleSet } from './puzzle-set'

const ensurePostIdPrefix = (id: string): `t3_${string}` =>
  id.startsWith('t3_') ? (id as `t3_${string}`) : `t3_${id}`

const scoreThreadText = [
  'Daily score thread: reply here with your result after solving.',
  'Generic score shares stay here; custom discussion is welcome as a normal comment.',
  'Keep exact solutions spoiler-safe.',
].join('\n')

export const ensureScoreThread = async (postId: string): Promise<string | null> => {
  const existing = await redis.get(`post:${postId}:scoreThreadCommentId`)
  if (existing) return existing

  const comment = await reddit.submitComment({
    id: ensurePostIdPrefix(postId),
    text: scoreThreadText,
  })

  await redis.set(`post:${postId}:scoreThreadCommentId`, comment.id)
  await redis.set(`post:${postId}:scoreThreadStickyStatus`, 'created')

  try {
    await comment.distinguish(true)
    await redis.set(`post:${postId}:scoreThreadStickyStatus`, 'stickied')
  } catch {
    await redis.set(`post:${postId}:scoreThreadStickyStatus`, 'created_unstickied')
  }

  return comment.id
}

const dailyPostTitle = (number: number): string => `Binary Grid #${number}`

/** Runs as soon as Reddit accepts a new post, before anything is stored for it. */
type OnPostSubmitted = (postId: string) => Promise<void>

const ignoreSubmittedPost: OnPostSubmitted = () => Promise.resolve()

/**
 * Stores what a post serves once Reddit has it: its stamp, the date's puzzles
 * under post-scoped IDs, and the score thread. A tier that already serves a
 * puzzle keeps it, so a solve in progress is never rejected, and finishing a
 * post a failed run left half done is safe.
 */
const setUpPost = async (
  postId: string,
  date: string,
  number: number,
  createdAt: Date
): Promise<void> => {
  await stampPost(postId, number, createdAt)

  // The date's first post seeds the set from its own ID unless the set was stored ahead.
  const puzzles = await getOrCreatePuzzleSet(date, (difficulty) =>
    generatePuzzleForPost(postId, difficulty)
  )
  for (const puzzle of puzzles) {
    if (await readPostPuzzle(postId, puzzle.difficulty)) continue
    await storePostPuzzle(postId, { ...puzzle, id: `${postId}:${puzzle.difficulty}` })
  }

  try {
    await ensureScoreThread(postId)
  } catch {
    await redis.set(`post:${postId}:scoreThreadStickyStatus`, 'failed')
  }
}

/**
 * Creates a puzzle post for a UTC date, with the date's #N and puzzle set,
 * stamped with the time it runs. A retry after midnight passes the date it
 * posts for. onSubmitted lets a caller record the post before a later step can fail.
 */
export const createPostForDate = async (
  date: string,
  now: Date,
  onSubmitted: OnPostSubmitted = ignoreSubmittedPost
) => {
  const { subredditName } = context
  if (!subredditName) {
    throw new Error('subredditName is required')
  }

  // Minted before posting, since the title carries it.
  const number = await getOrCreateDateNumber(date)
  const post = await reddit.submitCustomPost({
    subredditName,
    title: dailyPostTitle(number),
    entry: 'default'
  })
  await onSubmitted(post.id)
  await setUpPost(post.id, date, number, now)
  return post
}

/**
 * Creates a puzzle post for now's UTC date. Every post created on a UTC date,
 * scheduled or from the moderator menu, gets that date's #N and puzzle set;
 * each serves the set under its own post-scoped puzzle IDs, so boards stay per post.
 */
export const createPost = (
  now: Date = new Date(),
  onSubmitted: OnPostSubmitted = ignoreSubmittedPost
) => createPostForDate(toISODate(now), now, onSubmitted)

/**
 * Finishes a post whose creation stopped after Reddit accepted it, without
 * posting again. A post with no stamp yet is stamped with createdAt.
 */
export const completePost = async (
  postId: string,
  date: string,
  createdAt: Date
): Promise<void> => {
  const stamp = await readPostStamp(postId)
  const number = stamp?.number ?? (await getOrCreateDateNumber(date))
  await setUpPost(postId, date, number, stamp?.createdAt ?? createdAt)
}

/** Stores a date's puzzle set ahead of its first post, which then copies it. */
export const preparePuzzleSet = async (date: string): Promise<void> => {
  await getOrCreatePuzzleSet(date, (difficulty) => generatePuzzleForDate(date, difficulty))
}

export const crossPost = async (postId: string, subredditName: string) => {
  if (!postId) {
    throw new Error('postId is required')
  }
  if (!subredditName) {
    throw new Error('subredditName is required')
  }

  // Ensure postId has t3_ prefix for Reddit API
  const postIdWithPrefix = postId.startsWith('t3_')
    ? (postId as `t3_${string}`)
    : (`t3_${postId}` as `t3_${string}`)

  // Get the original post to retrieve its title
  const originalPost = await reddit.getPostById(postIdWithPrefix)
  if (!originalPost) {
    throw new Error(`Post not found: ${postIdWithPrefix}`)
  }
  const title = originalPost.title || 'Can you solve today\'s puzzle?'

  const crosspostedPost = await reddit.crosspost({
    postId: postIdWithPrefix,
    subredditName,
    title
  })

  return crosspostedPost
}
