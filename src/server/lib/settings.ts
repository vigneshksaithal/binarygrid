import { settings } from '@devvit/web/server'
import {
  DEFAULT_STREAK_WINDOW_HOURS,
  MAX_STREAK_WINDOW_HOURS,
  MIN_STREAK_WINDOW_HOURS,
  STREAK_RULES,
  type StreakRule,
} from '../../shared/streak'
// Subreddit settings, declared under `settings.subreddit` in devvit.json, with
// the defaults the app uses when a moderator hasn't chosen. Add settings only for
// rule and first-screen changes. Each read asks Devvit, so a moderator's change
// applies from the next request or scheduled run, with no deploy.
export const DAILY_POST_SLOTS = ['morning', 'evening'] as const
export type DailyPostSlot = (typeof DAILY_POST_SLOTS)[number]
export type AppSettings = {
  /** Which daily task posts the puzzle: morning (08:00 UTC) or evening (20:00 UTC). */
  dailyPostSlot: DailyPostSlot
  /** The first screen: title, rules line and legend above the grid, and Easy for new players. */
  firstScreen: boolean
  /** The streak every streak surface shows: counted by puzzle, or by calendar day as before. */
  streakRule: StreakRule
  /** Hours after #N posts during which a solve still counts for it. */
  streakWindowHours: number
}
export const DEFAULT_SETTINGS: Readonly<AppSettings> = {
  dailyPostSlot: 'morning',
  firstScreen: true,
  streakRule: 'puzzle',
  streakWindowHours: DEFAULT_STREAK_WINDOW_HOURS,
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
// A switch arrives as a boolean, false included. Anything else falls back to the default.
const pickSwitch = (value: SettingValue, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback
// A number setting arrives as a number. Anything else, or one out of range, falls back.
const pickNumberInRange = (
  value: SettingValue,
  min: number,
  max: number,
  fallback: number
): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : fallback
export const parseSettings = (values: Readonly<Record<string, SettingValue>>): AppSettings => ({
  dailyPostSlot: pickOption(DAILY_POST_SLOTS, values.dailyPostSlot, DEFAULT_SETTINGS.dailyPostSlot),
  firstScreen: pickSwitch(values.firstScreen, DEFAULT_SETTINGS.firstScreen),
  streakRule: pickOption(STREAK_RULES, values.streakRule, DEFAULT_SETTINGS.streakRule),
  streakWindowHours: pickNumberInRange(
    values.streakWindowHours,
    MIN_STREAK_WINDOW_HOURS,
    MAX_STREAK_WINDOW_HOURS,
    DEFAULT_SETTINGS.streakWindowHours
  ),
})
/** Reads the installed settings. A failed read throws rather than guess a value. */
export const readSettings = async (): Promise<AppSettings> =>
  parseSettings(await settings.getAll())
