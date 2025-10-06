import { context, reddit, redis } from '@devvit/web/server'
import type { Difficulty } from '../../shared/types/puzzle'
import { generatePuzzleForPost } from './generator'

export const createPost = async (difficulty: Difficulty = 'medium') => {
  const { subredditName } = context
  if (!subredditName) {
    throw new Error('subredditName is required')
  }

  // Create the post first
  const post = await reddit.submitCustomPost({
    splash: {
      appDisplayName: 'Binary Grid',
      backgroundUri: 'Binary-Grid-Splash-Screen.png',
      buttonLabel: 'Play Now',
      description: 'A fast-paced daily logic puzzle of 0s and 1s',
      heading: 'Welcome to Binary Grid!',
      appIconUri: 'icon-512.png'
    },
    subredditName,
    title: `Binary Grid - ${new Date().toISOString().split('T')[0]} (${difficulty})`
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
