import { context, reddit, redis } from '@devvit/web/server'
import { getUTCWeekId } from '../../shared/growth'
import type { Difficulty } from '../../shared/types/puzzle'
import { formatTime } from '../../shared/utils/format'
import { generatePuzzleForPost } from './generator'

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
    const puzzle = generatePuzzleForPost(post.id, difficulty)
    await redis.hSet(`post:${post.id}:puzzle:${difficulty}`, {
      id: puzzle.id,
      size: puzzle.size.toString(),
      difficulty: puzzle.difficulty,
      fixed: JSON.stringify(puzzle.fixed),
      initial: JSON.stringify(puzzle.initial)
    })
  }

  try {
    await ensureScoreThread(post.id)
  } catch {
    await redis.set(`post:${post.id}:scoreThreadStickyStatus`, 'failed')
  }

  return post
}

const formatLeaderboardLine = (
  entry: { member: string; score: number },
  index: number
): string => `${index + 1}. ${entry.member} - ${formatTime(Math.round(entry.score))}`

export const createWeeklyRecap = async () => {
  const { subredditName } = context
  if (!subredditName) {
    throw new Error('subredditName is required')
  }

  const weekId = getUTCWeekId()
  const post = await reddit.submitCustomPost({
    subredditName,
    title: `Binary Grid weekly recap: ${weekId}`,
    entry: 'default'
  })

  const [easy, medium, hard] = await Promise.all(
    DIFFICULTIES.map((difficulty) =>
      redis.zRange(`leaderboard:weekly:${weekId}:${difficulty}`, 0, 2, {
        by: 'rank',
      })
    )
  )
  const lines = [
    'Weekly recap',
    '',
    'Easy',
    ...(easy ?? []).map(formatLeaderboardLine),
    '',
    'Medium',
    ...(medium ?? []).map(formatLeaderboardLine),
    '',
    'Hard',
    ...(hard ?? []).map(formatLeaderboardLine),
    '',
    'New puzzle is live in the latest Binary Grid post.',
  ]

  await reddit.submitComment({
    id: ensurePostIdPrefix(post.id),
    text: lines.join('\n'),
  })

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
