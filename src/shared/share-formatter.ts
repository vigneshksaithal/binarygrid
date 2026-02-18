import type { Difficulty, Grid } from './types/puzzle'
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

export const formatSimpleShareText = (input: SimpleShareInput): string => {
    const { dayNumber, completionTime, difficulty } = input
    let text = `Binary Grid #${dayNumber} 🧩 ⏱️ ${formatTime(completionTime)} | 🎯 ${DIFFICULTY_LABELS[difficulty]}`
    
    if (input.streak !== undefined && input.streak >= 2) {
        text += ` 🔥 ${input.streak} day streak`
    }
    
    return text
}
