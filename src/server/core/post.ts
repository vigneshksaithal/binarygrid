import { context, reddit, redis } from '@devvit/web/server'
import { toISODate } from '../../shared/baseline'
import { generatePuzzleForPost } from './generator'
import { storePostPuzzle } from './post-puzzle'
import { getOrCreateDateNumber, stampPost } from './puzzle-number'
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

/**
 * Creates a puzzle post. Every post created on a UTC date, scheduled or from
 * the moderator menu, gets that date's #N and puzzle set; each serves the set
 * under its own post-scoped puzzle IDs, so boards stay per post.
 */
export const createPost = async (now: Date = new Date()) => {
  const { subredditName } = context
  if (!subredditName) {
    throw new Error('subredditName is required')
  }

  const date = toISODate(now)
  // Minted before posting, since the title carries it.
  const number = await getOrCreateDateNumber(date)
  const post = await reddit.submitCustomPost({
    subredditName,
    title: dailyPostTitle(number),
    entry: 'default'
  })
  await stampPost(post.id, number, now)

  // The date's first post seeds the set from its own ID, as every post did before.
  const puzzles = await getOrCreatePuzzleSet(date, (difficulty) =>
    generatePuzzleForPost(post.id, difficulty)
  )
  for (const puzzle of puzzles) {
    await storePostPuzzle(post.id, { ...puzzle, id: `${post.id}:${puzzle.difficulty}` })
  }

  try {
    await ensureScoreThread(post.id)
  } catch {
    await redis.set(`post:${post.id}:scoreThreadStickyStatus`, 'failed')
  }

  return post
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
