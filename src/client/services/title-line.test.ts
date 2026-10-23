import { describe, expect, it } from 'vitest'
import { formatTitleLine } from './title-line'

describe('formatTitleLine', () => {
  it("names the game, today's number and the subreddit", () => {
    expect(formatTitleLine(128, 'binarygrid')).toBe('Binary Grid #128 · r/binarygrid')
  })

  it('leaves the number out until it is known', () => {
    expect(formatTitleLine(null, 'binarygrid')).toBe('Binary Grid · r/binarygrid')
  })

  it('leaves the subreddit out when the context has none', () => {
    expect(formatTitleLine(128, undefined)).toBe('Binary Grid #128')
    expect(formatTitleLine(null, '')).toBe('Binary Grid')
  })
})
