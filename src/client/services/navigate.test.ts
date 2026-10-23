import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@devvit/web/client', () => ({ navigateToPost: vi.fn() }))

import { navigateToPost } from '@devvit/web/client'
import { openPost } from './navigate'

beforeEach(() => {
  vi.mocked(navigateToPost).mockClear()
})

describe('openPost', () => {
  it("opens the post with Devvit's navigateToPost", () => {
    openPost('t3_post127')

    expect(navigateToPost).toHaveBeenCalledWith('t3_post127')
  })

  it('ignores an ID that is not a post', () => {
    openPost('t2_user_456')

    expect(navigateToPost).not.toHaveBeenCalled()
  })
})
