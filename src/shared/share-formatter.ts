import type { Difficulty, Grid } from './types/puzzle'
import { formatTime as formatTimeString } from './utils/format'

export interface ShareTextInput {
    grid: Grid
    dayNumber: number
    completionTime: number
    difficulty: Difficulty
    subredditName: string
}

export interface ShareTextOutput {
    text: string
    gridText: string
}

const CELL_EMOJI = {
    0: '⬜',
    1: '🟩',
} as const

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
}

export const formatGridAsText = (grid: Grid): string => {
    return grid
        .map((row) =>
            row
                .map((cell) => {
                    if (cell === 0) return CELL_EMOJI[0]
                    if (cell === 1) return CELL_EMOJI[1]
                    return '⬛'
                })
                .join('')
        )
        .join('\n')
}

export const formatTime = formatTimeString

export const formatShareText = (input: ShareTextInput): ShareTextOutput => {
    const { grid, dayNumber, completionTime, difficulty, subredditName } = input

    const header = `Binary Grid #${dayNumber} 🧩`
    const timeLine = `⏱️ ${formatTime(completionTime)} | 🎯 ${DIFFICULTY_LABELS[difficulty]}`
    const gridText = formatGridAsText(grid)
    const footer = `Play at r/${subredditName}`

    const text = [header, timeLine, '', gridText, '', footer].join('\n')

    return {
        text,
        gridText,
    }
}

export interface SimpleShareInput {
    dayNumber: number
    completionTime: number
    difficulty: Difficulty
    streak?: number | undefined
}

export const formatSimpleShareText = (input: SimpleShareInput): string => {
    const { dayNumber, completionTime, difficulty } = input
    let text = `Binary Grid #${dayNumber} 🧩 ⏱️ ${formatTime(completionTime)} | 🎯 ${DIFFICULTY_LABELS[difficulty]}`
    
    if (input.streak !== undefined && input.streak >= 2) {
        text += ` 🔥 ${input.streak} day streak`
    }
    
    return text
}

// ── Score comment ───────────────────────────────────────────────────────────

/** Streak lengths the score comment calls out as milestones. */
export const STREAK_MILESTONES = [7, 14, 30, 50, 100] as const

const MIN_SHARED_STREAK = 2

/** Longest "own words" a player can add to a score comment. */
export const MAX_OWN_WORDS_LENGTH = 280

/** Error the share route returns for a logged-out player. */
export const SHARE_LOGIN_REQUIRED_ERROR = 'login required'

export const SHARE_TEMPLATE_IDS = ['beat_time', 'pure_logic', 'streak_save'] as const

export type ShareTemplateId = (typeof SHARE_TEMPLATE_IDS)[number]

const SHARE_TEMPLATES: Record<ShareTemplateId, (time: string) => string> = {
    beat_time: (time) => `Beat my time: ${time}.`,
    pure_logic: () => 'No guesses. Pure logic.',
    streak_save: () => 'Saved my streak by one cell.',
}

/** A generic score replies in the score thread; a comment with the player's own words goes top-level. */
export type ShareMode = 'scoreThread' | 'customTopLevel'

/** The score share the client previews and sends, and the server formats and posts. */
export type ScoreShareRequest = {
    dayNumber: number
    solveTimeSeconds: number
    difficulty: Difficulty
    streak?: number
    rank?: number
    templateId?: ShareTemplateId
    customText?: string
}

export const isShareTemplateId = (value: unknown): value is ShareTemplateId =>
    typeof value === 'string' && (SHARE_TEMPLATE_IDS as readonly string[]).includes(value)

const isStreakMilestone = (streak: number): boolean =>
    (STREAK_MILESTONES as readonly number[]).includes(streak)

const formatStreak = (streak: number | undefined): string | undefined => {
    if (streak === undefined || streak < MIN_SHARED_STREAK) return undefined
    const milestone = isStreakMilestone(streak) ? ' milestone' : ''
    return `${streak}-day streak${milestone}`
}

const formatRank = (rank: number | undefined): string | undefined =>
    rank !== undefined && rank >= 1 ? `rank #${rank}` : undefined

const formatScoreLine = (request: ScoreShareRequest, time: string): string =>
    [
        `Solved Binary Grid #${request.dayNumber} in ${time}`,
        DIFFICULTY_LABELS[request.difficulty],
        formatStreak(request.streak),
        formatRank(request.rank),
    ]
        .filter(Boolean)
        .join(' | ')

/**
 * Formats a score comment: one plain line, then the player's own words or the
 * template line. No grid, and no solve label until the Clean label can be earned (task 3).
 * The client previews this text and the server posts it, so the two cannot drift.
 */
export const formatScoreShareText = (request: ScoreShareRequest): string => {
    const time = formatTime(request.solveTimeSeconds)
    const ownWords = request.customText?.trim()
    const templateLine = request.templateId ? SHARE_TEMPLATES[request.templateId](time) : undefined

    // A blank line makes Reddit show the second line as its own paragraph, as the preview does
    return [formatScoreLine(request, time), ownWords || templateLine].filter(Boolean).join('\n\n')
}

export const getShareMode = (request: Pick<ScoreShareRequest, 'customText'>): ShareMode =>
    request.customText?.trim() ? 'customTopLevel' : 'scoreThread'
