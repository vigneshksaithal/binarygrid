const GAME_NAME = 'Binary Grid'

/**
 * The frame's title line, such as "Binary Grid #128 · r/binarygrid". Each part
 * shows once it's known: #N comes from the server, the subreddit from the
 * Devvit context.
 */
export const formatTitleLine = (
  puzzleNumber: number | null,
  subredditName: string | undefined
): string => {
  const title = puzzleNumber === null ? GAME_NAME : `${GAME_NAME} #${puzzleNumber}`
  return subredditName ? `${title} · r/${subredditName}` : title
}
