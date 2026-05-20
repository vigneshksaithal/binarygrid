import type { Difficulty, Grid } from './types/puzzle'
import { SOLVE_QUALITY_LABELS, type SolveQuality } from './growth'
import { formatTime as formatTimeString } from './utils/format'

export interface ShareTextInput {
    grid: Grid
    dayNumber: number
    completionTime: number
    difficulty: Difficulty
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
    const { grid, dayNumber, completionTime, difficulty } = input

    const header = `Binary Grid #${dayNumber} 🧩`
    const timeLine = `⏱️ ${formatTime(completionTime)} | 🎯 ${DIFFICULTY_LABELS[difficulty]}`
    const gridText = formatGridAsText(grid)
    const footer = 'Play at r/binarygrid'

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

export interface ScoreShareInput extends SimpleShareInput {
    solveQuality?: SolveQuality | undefined
    rank?: number | undefined
    templateId?: string | undefined
    customText?: string | undefined
}

export const formatSimpleShareText = (input: SimpleShareInput): string => {
    const { dayNumber, completionTime, difficulty } = input
    let text = `Binary Grid #${dayNumber} 🧩 ⏱️ ${formatTime(completionTime)} | 🎯 ${DIFFICULTY_LABELS[difficulty]}`
    
    if (input.streak !== undefined && input.streak >= 2) {
        text += ` 🔥 ${input.streak} day streak`
    }
    
    return text
}

const SHARE_TEMPLATES: Record<string, (time: string) => string> = {
    beat_time: (time) => `Beat my time: ${time}.`,
    pure_logic: () => 'No guesses. Pure logic.',
    streak_save: () => 'Saved my streak by one cell.',
}

export const formatScoreShareText = (input: ScoreShareInput): string => {
    const time = formatTime(input.completionTime)
    const parts = [
        `Solved Binary Grid #${input.dayNumber} in ${time}`,
        DIFFICULTY_LABELS[input.difficulty],
    ]

    if (input.solveQuality) {
        parts.push(SOLVE_QUALITY_LABELS[input.solveQuality])
    }
    if (input.streak !== undefined && input.streak >= 2) {
        parts.push(`${input.streak}-day streak`)
    }
    if (input.rank !== undefined && input.rank >= 1) {
        parts.push(`rank #${input.rank}`)
    }

    const baseText = parts.join(' | ')
    const templateText = input.templateId
        ? SHARE_TEMPLATES[input.templateId]?.(time)
        : undefined
    const customText = input.customText?.trim()

    return [baseText, customText || templateText].filter(Boolean).join('\n')
}

// ── Replay post (new post to r/binarygrid) ──────────────────────────────────

export interface ReplayPostInput {
    grid: Grid
    dayNumber: number
    completionTime: number
    difficulty: Difficulty
    solveQuality?: SolveQuality | undefined
    streak?: number | undefined
    rank?: number | undefined
    fasterThanPercentile?: number | undefined
}

/**
 * Formats the full body text for a standalone replay post submitted to r/binarygrid.
 * This is the "fix" for the closed-loop share problem: instead of commenting on the
 * game post itself, this content becomes a new post so it reaches the subreddit feed.
 */
export const formatReplayPostText = (input: ReplayPostInput): string => {
    const time = formatTime(input.completionTime)
    const diffLabel = DIFFICULTY_LABELS[input.difficulty]
    const gridText = formatGridAsText(input.grid)

    const lines: string[] = [
        `**Binary Grid #${input.dayNumber}** — ${diffLabel}`,
        `⏱️ ${time}`,
    ]

    if (input.solveQuality) {
        lines.push(`✨ ${SOLVE_QUALITY_LABELS[input.solveQuality]}`)
    }
    if (input.fasterThanPercentile !== undefined && input.fasterThanPercentile > 0) {
        lines.push(`⚡ Faster than ${input.fasterThanPercentile}% of players today`)
    }
    if (input.rank !== undefined && input.rank >= 1) {
        lines.push(`🏆 Rank #${input.rank}`)
    }
    if (input.streak !== undefined && input.streak >= 2) {
        lines.push(`🔥 ${input.streak}-day streak`)
    }

    lines.push('', gridText, '', '**Can you beat my time?** 👇')

    return lines.join('\n')
}

/**
 * Formats the title for a standalone replay post.
 */
export const formatReplayPostTitle = (input: Pick<ReplayPostInput, 'dayNumber' | 'completionTime' | 'difficulty'>): string => {
    const time = formatTime(input.completionTime)
    const diffLabel = DIFFICULTY_LABELS[input.difficulty]
    return `Binary Grid #${input.dayNumber} — ${diffLabel} in ${time}`
}

// ── Streak Confession post ──────────────────────────────────────────────────

export interface StreakConfessionInput {
    streak: number
    username: string
}

const STREAK_CONFESSION_COPY: Record<number, { body: string; emoji: string }> = {
    7: {
        emoji: '🔥',
        body: "One week in. Started this to kill time. Still here.",
    },
    14: {
        emoji: '🔥🔥',
        body: "Two weeks. I've started optimising my morning routine around a binary puzzle. This is fine.",
    },
    30: {
        emoji: '🔥🔥🔥',
        body: "30 days. I don't know how I got here. I think I have a problem.",
    },
    50: {
        emoji: '👑',
        body: "50 days. My streak has outlasted multiple gym memberships.",
    },
    100: {
        emoji: '💎',
        body: "100 days. At this point the game is load-bearing in my daily routine.",
    },
}

const DEFAULT_STREAK_COPY = (streak: number) => ({
    emoji: '🔥',
    body: `${streak} consecutive days of Binary Grid. I don't have an explanation.`,
})

/**
 * Returns the self-aware, Reddit-native body text for a streak confession post.
 * Deliberately self-deprecating — this is the Marcus Johnson school of Redditor psychology.
 */
export const formatStreakConfessionText = (input: StreakConfessionInput): string => {
    const copy = STREAK_CONFESSION_COPY[input.streak] ?? DEFAULT_STREAK_COPY(input.streak)

    const lines = [
        `${copy.emoji} Day ${input.streak} of Binary Grid`,
        '',
        copy.body,
        '',
        '---',
        `*Playing at r/binarygrid — daily logic puzzle, free, no account required beyond Reddit*`,
    ]

    return lines.join('\n')
}

/**
 * Returns the title for a streak confession post.
 */
export const formatStreakConfessionTitle = (streak: number): string => {
    const copy = STREAK_CONFESSION_COPY[streak] ?? DEFAULT_STREAK_COPY(streak)
    return `${copy.emoji} Day ${streak} of Binary Grid. I think I have a problem.`
}
