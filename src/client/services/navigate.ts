import { navigateToPost } from '@devvit/web/client'

const isPostId = (id: string): id is `t3_${string}` => id.startsWith('t3_')

/** Opens another post in Reddit, such as an earlier #N that still counts (unverified on Devvit 0.15). */
export const openPost = (postId: string): void => {
  if (isPostId(postId)) navigateToPost(postId)
}
