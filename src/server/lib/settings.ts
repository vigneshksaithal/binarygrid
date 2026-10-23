import { settings } from '@devvit/web/server'

// Subreddit settings, declared under `settings.subreddit` in devvit.json, with
// the defaults the app uses when a moderator hasn't chosen. Add settings only for
// rule and first-screen changes. Each read asks Devvit, so a moderator's change
// applies from the next request or scheduled run, with no deploy.

export const DAILY_POST_SLOTS = ['morning', 'evening'] as const

export type DailyPostSlot = (typeof DAILY_POST_SLOTS)[number]

export type AppSettings = {
  /** Which daily task posts the puzzle: morning (08:00 UTC) or evening (20:00 UTC). */
  dailyPostSlot: DailyPostSlot
}

export const DEFAULT_SETTINGS: Readonly<AppSettings> = {
  dailyPostSlot: 'morning',
}

type SettingValue = string | number | boolean | string[] | undefined

// A chosen select option comes back as a list of one value, but a devvit.json
// default arrives as a plain string. Anything else falls back to the default.
const pickOption = <T extends string>(
  options: readonly T[],
  value: SettingValue,
  fallback: T
): T => {
  const chosen = Array.isArray(value) ? value[0] : value
  return options.find((option) => option === chosen) ?? fallback
}

export const parseSettings = (values: Readonly<Record<string, SettingValue>>): AppSettings => ({
  dailyPostSlot: pickOption(DAILY_POST_SLOTS, values.dailyPostSlot, DEFAULT_SETTINGS.dailyPostSlot),
})

/** Reads the installed settings. A failed read throws rather than guess a value. */
export const readSettings = async (): Promise<AppSettings> =>
  parseSettings(await settings.getAll())
