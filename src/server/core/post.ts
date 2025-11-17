import { context, reddit, redis } from '@devvit/web/server'
import type { Difficulty } from '../../shared/types/puzzle'
import { generatePuzzleForPost } from './generator'

export const createPost = async (difficulty: Difficulty = 'easy') => {
  const { subredditName } = context
  if (!subredditName) {
    throw new Error('subredditName is required')
  }

  const post = await reddit.submitCustomPost({
    subredditName,
    title: `Binary Grid: ${new Date().toISOString().split('T')[0]}`
  })

  // Generate and store the puzzle for this specific post
  const puzzle = generatePuzzleForPost(post.id, difficulty)
  await redis.hSet(`post:${post.id}:puzzle`, {
    id: puzzle.id,
    size: puzzle.size.toString(),
    difficulty: puzzle.difficulty,
    fixed: JSON.stringify(puzzle.fixed),
    initial: JSON.stringify(puzzle.initial)
  })

  return post
}
