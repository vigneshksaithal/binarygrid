import { showLoginPrompt } from '@devvit/web/client'
import { awaitLoginReturn } from '../stores/submit'

/**
 * Opens Reddit's login prompt for a logged-out solver and holds their solve,
 * so it's resent if the webview survives the login (unverified on Devvit 0.15).
 */
export const promptLogin = (): void => {
  awaitLoginReturn()
  showLoginPrompt()
}
