import { beforeEach, describe, expect, it, vi } from 'vitest'

const fake = await vi.hoisted(async () =>
  (await import('../test-helpers/devvit-fake')).createDevvitServerFake()
)
vi.mock('@devvit/web/server', () => fake)

import devvitConfig from '../../../devvit.json'
import { STREAK_RULES } from '../../shared/streak'
import { DAILY_POST_SLOTS, DEFAULT_SETTINGS, parseSettings, readSettings } from './settings'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('parseSettings', () => {
  it('uses the defaults when nothing is set', () => {
    expect(parseSettings({})).toEqual({
      dailyPostSlot: 'morning',
      firstScreen: true,
      streakRule: 'puzzle',
      streakWindowHours: 36,
    })
  })

  it('reads a chosen select option, which Devvit returns as a list', () => {
    expect(parseSettings({ dailyPostSlot: ['evening'] })).toEqual({
      ...DEFAULT_SETTINGS,
      dailyPostSlot: 'evening',
    })
    expect(parseSettings({ dailyPostSlot: ['morning'] })).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings({ streakRule: ['calendar'] })).toEqual({
      ...DEFAULT_SETTINGS,
      streakRule: 'calendar',
    })
  })

  it('reads a plain string, the shape of a devvit.json default', () => {
    expect(parseSettings({ dailyPostSlot: 'evening', streakRule: 'calendar' })).toEqual({
      ...DEFAULT_SETTINGS,
      dailyPostSlot: 'evening',
      streakRule: 'calendar',
    })
  })

  it.each([
    ['an unknown option', ['noon']],
    ['an unknown string', 'Evening'],
    ['an empty selection', []],
    ['a number', 20],
    ['a boolean', true],
  ])('falls back to the default for %s', (_case, value) => {
    expect(parseSettings({ dailyPostSlot: value, streakRule: value })).toEqual(DEFAULT_SETTINGS)
  })

  it.each([1, 24, 36.5, 48, 168])('reads a streak window of %s hours', (hours) => {
    expect(parseSettings({ streakWindowHours: hours }).streakWindowHours).toBe(hours)
  })

  it.each([
    ['zero', 0],
    ['a negative number', -12],
    ['more than a week', 169],
    ['not a number', Number.NaN],
    ['a string', '48'],
    ['a list', ['48']],
    ['a boolean', true],
  ])('uses the 36-hour window for %s', (_case, value) => {
    expect(parseSettings({ streakWindowHours: value }).streakWindowHours).toBe(36)
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
    fake.settings.getAll.mockResolvedValueOnce({
      dailyPostSlot: ['evening'],
      firstScreen: false,
      streakRule: ['calendar'],
      streakWindowHours: 48,
    })

    expect(await readSettings()).toEqual({
      dailyPostSlot: 'morning',
      firstScreen: true,
      streakRule: 'puzzle',
      streakWindowHours: 36,
    })
    expect(await readSettings()).toEqual({
      dailyPostSlot: 'evening',
      firstScreen: false,
      streakRule: 'calendar',
      streakWindowHours: 48,
    })
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

  it("declares streakRule as a select with the reader's rules and default", () => {
    const setting = devvitConfig.settings.subreddit.streakRule

    expect(setting.type).toBe('select')
    expect(setting.options.map((option) => option.value)).toEqual([...STREAK_RULES])
    expect(setting.defaultValue).toBe(DEFAULT_SETTINGS.streakRule)
  })

  it("declares streakWindowHours as a number with the reader's default", () => {
    const setting = devvitConfig.settings.subreddit.streakWindowHours

    expect(setting.type).toBe('number')
    expect(setting.defaultValue).toBe(DEFAULT_SETTINGS.streakWindowHours)
  })
})
