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
    expect(parseSettings({})).toEqual({ dailyPostSlot: 'morning', firstScreen: true })
  })

  it('reads a chosen select option, which Devvit returns as a list', () => {
    expect(parseSettings({ dailyPostSlot: ['evening'] })).toEqual({
      ...DEFAULT_SETTINGS,
      dailyPostSlot: 'evening',
    })
    expect(parseSettings({ dailyPostSlot: ['morning'] })).toEqual({
      ...DEFAULT_SETTINGS,
      dailyPostSlot: 'morning',
    })
  })

  it('reads a plain string, the shape of a devvit.json default', () => {
    expect(parseSettings({ dailyPostSlot: 'evening' })).toEqual({
      ...DEFAULT_SETTINGS,
      dailyPostSlot: 'evening',
    })
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

  it('reads the first-screen switch in either position', () => {
    expect(parseSettings({ firstScreen: false })).toEqual({ ...DEFAULT_SETTINGS, firstScreen: false })
    expect(parseSettings({ firstScreen: true })).toEqual({ ...DEFAULT_SETTINGS, firstScreen: true })
  })

  it.each([
    ['a string', 'false'],
    ['a number', 0],
    ['a list', ['false']],
  ])('keeps the first screen on for %s', (_case, value) => {
    expect(parseSettings({ firstScreen: value }).firstScreen).toBe(true)
  })
})

describe('readSettings', () => {
  it('asks Devvit on every read, so a change applies without a deploy', async () => {
    fake.settings.getAll.mockResolvedValueOnce({})
    fake.settings.getAll.mockResolvedValueOnce({ dailyPostSlot: ['evening'], firstScreen: false })

    expect(await readSettings()).toEqual({ dailyPostSlot: 'morning', firstScreen: true })
    expect(await readSettings()).toEqual({ dailyPostSlot: 'evening', firstScreen: false })
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

  it("declares firstScreen as a switch with the reader's default", () => {
    const setting = devvitConfig.settings.subreddit.firstScreen

    expect(setting.type).toBe('boolean')
    expect(setting.defaultValue).toBe(DEFAULT_SETTINGS.firstScreen)
  })
})
