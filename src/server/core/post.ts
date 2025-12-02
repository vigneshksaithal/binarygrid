import { context, reddit, redis } from '@devvit/web/server'
import type { Difficulty } from '../../shared/types/puzzle'
import { generatePuzzleForPost } from './generator'

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']
export const TARGET_CROSSPOST_SUBREDDIT = 'RedditGames'

export const createPost = async () => {
  const { subredditName } = context
  if (!subredditName) {
    throw new Error('subredditName is required')
  }

  const post = await reddit.submitCustomPost({
    subredditName,
    title: `Binary Grid: ${new Date().toISOString().split('T')[0]}`
  })

  // Generate and store puzzles for all three difficulty levels
  for (const difficulty of DIFFICULTIES) {
    const puzzle = generatePuzzleForPost(post.id, difficulty)
    await redis.hSet(`post:${post.id}:puzzle:${difficulty}`, {
      id: puzzle.id,
      size: puzzle.size.toString(),
      difficulty: puzzle.difficulty,
      fixed: JSON.stringify(puzzle.fixed),
      initial: JSON.stringify(puzzle.initial)
    })
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
