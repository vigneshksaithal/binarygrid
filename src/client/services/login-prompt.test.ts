import { describe, expect, it, vi } from 'vitest'

vi.mock('@devvit/web/client', () => ({ showLoginPrompt: vi.fn() }))
vi.mock('../stores/submit', () => ({ awaitLoginReturn: vi.fn() }))

import { showLoginPrompt } from '@devvit/web/client'
import { awaitLoginReturn } from '../stores/submit'
import { promptLogin } from './login-prompt'

describe('promptLogin', () => {
  it("opens Reddit's login prompt and holds the solve for the player's return", () => {
    promptLogin()

    expect(showLoginPrompt).toHaveBeenCalledTimes(1)
    expect(awaitLoginReturn).toHaveBeenCalledTimes(1)
  })
})
