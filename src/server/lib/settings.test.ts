import { beforeEach, describe, expect, it, vi } from 'vitest'

const fake = await vi.hoisted(async () =>
  (await import('../test-helpers/devvit-fake')).createDevvitServerFake()
)
vi.mock('@devvit/web/server', () => fake)

import devvitConfig from '../../../devvit.json'
import { DAILY_POST_SLOTS, DEFAULT_SETTINGS, parseSettings, readSettings } from './settings'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('parseSettings', () => {
  it('uses the defaults when nothing is set', () => {
    expect(parseSettings({})).toEqual({ dailyPostSlot: 'morning' })
  })

  it('reads a chosen select option, which Devvit returns as a list', () => {
    expect(parseSettings({ dailyPostSlot: ['evening'] })).toEqual({ dailyPostSlot: 'evening' })
    expect(parseSettings({ dailyPostSlot: ['morning'] })).toEqual({ dailyPostSlot: 'morning' })
  })

  it('reads a plain string, the shape of a devvit.json default', () => {
    expect(parseSettings({ dailyPostSlot: 'evening' })).toEqual({ dailyPostSlot: 'evening' })
  })

  it.each([
    ['an unknown option', ['noon']],
    ['an unknown string', 'Evening'],
    ['an empty selection', []],
    ['a number', 20],
    ['a boolean', true],
  ])('falls back to the default for %s', (_case, value) => {
    expect(parseSettings({ dailyPostSlot: value })).toEqual(DEFAULT_SETTINGS)
  })
})

describe('readSettings', () => {
  it('asks Devvit on every read, so a change applies without a deploy', async () => {
    fake.settings.getAll.mockResolvedValueOnce({})
    fake.settings.getAll.mockResolvedValueOnce({ dailyPostSlot: ['evening'] })

    expect(await readSettings()).toEqual({ dailyPostSlot: 'morning' })
    expect(await readSettings()).toEqual({ dailyPostSlot: 'evening' })
  })

  it('fails when the settings service fails, instead of guessing a value', async () => {
    fake.settings.getAll.mockRejectedValueOnce(new Error('Could not get installation settings'))

    await expect(readSettings()).rejects.toThrow('Could not get installation settings')
  })
})

describe('devvit.json subreddit settings', () => {
  it("declares dailyPostSlot as a select with the reader's options and default", () => {
    const setting = devvitConfig.settings.subreddit.dailyPostSlot

    expect(setting.type).toBe('select')
    expect(setting.options.map((option) => option.value)).toEqual([...DAILY_POST_SLOTS])
    expect(setting.defaultValue).toBe(DEFAULT_SETTINGS.dailyPostSlot)
  })
})
