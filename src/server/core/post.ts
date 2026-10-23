import { context, reddit, redis } from '@devvit/web/server'
import type { Difficulty } from '../../shared/types/puzzle'
import { generatePuzzleForPost } from './generator'
import { storePostPuzzle } from './post-puzzle'

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']
export const TARGET_CROSSPOST_SUBREDDIT = 'RedditGames'

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

export const createPost = async () => {
  const { subredditName } = context
  if (!subredditName) {
    throw new Error('subredditName is required')
  }

  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]
  const hour = now.getUTCHours()
  const session = hour < 14 ? 'Morning' : 'Evening'

  const post = await reddit.submitCustomPost({
    subredditName,
    title: `Binary Grid: ${dateStr} (${session})`,
    entry: 'default'
  })

  // Generate and store puzzles for all three difficulty levels
  for (const difficulty of DIFFICULTIES) {
    await storePostPuzzle(post.id, generatePuzzleForPost(post.id, difficulty))
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

export const crosspostLatestPost = async (
  postId: string,
  targetSubreddit: string = TARGET_CROSSPOST_SUBREDDIT
) => {
  if (!postId) {
    throw new Error('postId is required')
  }
  if (!targetSubreddit) {
    throw new Error('targetSubreddit is required')
  }

  return await crossPost(postId, targetSubreddit)
}
