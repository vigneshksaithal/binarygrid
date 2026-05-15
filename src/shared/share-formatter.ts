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
