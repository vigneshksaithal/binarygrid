import { describe, expect, it } from 'vitest'
import * as fc from 'fast-check'
import type { Difficulty, Grid } from './types/puzzle'
import {
    formatGridAsText,
    formatScoreShareText,
    formatShareText,
    formatTime,
    getShareMode,
    type ScoreShareRequest,
    type ShareTemplateId,
    type ShareTextInput,
} from './share-formatter'

// Any install other than r/binarygrid: the footer must name the install's own subreddit
const SUBREDDIT = 'logicpuzzles'
const subredditArbitrary = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9_]{2,20}$/)

describe('formatTime', () => {
    it('formats 0 seconds as 00:00', () => {
        expect(formatTime(0)).toBe('00:00')
    })

    it('formats seconds under a minute with leading zeros', () => {
        expect(formatTime(5)).toBe('00:05')
        expect(formatTime(59)).toBe('00:59')
    })

    it('formats exactly 60 seconds as 01:00', () => {
        expect(formatTime(60)).toBe('01:00')
    })

    it('formats minutes and seconds correctly', () => {
        expect(formatTime(154)).toBe('02:34')
        expect(formatTime(599)).toBe('09:59')
    })

    it('formats times over 10 minutes', () => {
        expect(formatTime(600)).toBe('10:00')
        expect(formatTime(3661)).toBe('61:01')
    })
})

describe('formatGridAsText', () => {
    it('maps 0 to white square and 1 to green square', () => {
        const grid: Grid = [
            [0, 1, 0, 1, 0, 1],
            [1, 0, 1, 0, 1, 0],
            [0, 1, 0, 1, 0, 1],
            [1, 0, 1, 0, 1, 0],
            [0, 1, 0, 1, 0, 1],
            [1, 0, 1, 0, 1, 0],
        ]
        const result = formatGridAsText(grid)
        const lines = result.split('\n')

        expect(lines).toHaveLength(6)
        expect(lines[0]).toBe('⬜🟩⬜🟩⬜🟩')
        expect(lines[1]).toBe('🟩⬜🟩⬜🟩⬜')
    })

    it('formats all zeros grid', () => {
        const grid: Grid = Array.from({ length: 6 }, () =>
            Array.from({ length: 6 }, () => 0)
        ) as Grid
        const result = formatGridAsText(grid)
        const lines = result.split('\n')

        expect(lines).toHaveLength(6)
        for (const line of lines) {
            expect(line).toBe('⬜⬜⬜⬜⬜⬜')
        }
    })

    it('formats all ones grid', () => {
        const grid: Grid = Array.from({ length: 6 }, () =>
            Array.from({ length: 6 }, () => 1)
        ) as Grid
        const result = formatGridAsText(grid)
        const lines = result.split('\n')

        expect(lines).toHaveLength(6)
        for (const line of lines) {
            expect(line).toBe('🟩🟩🟩🟩🟩🟩')
        }
    })
})

describe('formatShareText', () => {
    const sampleGrid: Grid = [
        [0, 1, 0, 1, 1, 0],
        [1, 0, 1, 0, 0, 1],
        [0, 1, 1, 0, 1, 0],
        [1, 0, 0, 1, 0, 1],
        [0, 1, 0, 1, 1, 0],
        [1, 0, 1, 0, 0, 1],
    ]

    it('generates complete share text with all sections', () => {
        const input: ShareTextInput = {
            grid: sampleGrid,
            dayNumber: 47,
            completionTime: 154,
            difficulty: 'medium',
            subredditName: SUBREDDIT,
        }
        const result = formatShareText(input)

        expect(result.text).toContain('Binary Grid #47 🧩')
        expect(result.text).toContain('⏱️ 02:34 | 🎯 Medium')
        expect(result.text).toContain(`Play at r/${SUBREDDIT}`)
    })

    it('names the subreddit the game is installed in', () => {
        const base = { grid: sampleGrid, dayNumber: 3, completionTime: 9, difficulty: 'easy' } as const

        expect(formatShareText({ ...base, subredditName: 'binarygrid' }).text).toContain('Play at r/binarygrid')
        expect(formatShareText({ ...base, subredditName: 'puzzles' }).text).toContain('Play at r/puzzles')
        expect(formatShareText({ ...base, subredditName: 'puzzles' }).text).not.toContain('r/binarygrid')
    })

    it('includes grid text in output', () => {
        const input: ShareTextInput = {
            grid: sampleGrid,
            dayNumber: 1,
            completionTime: 0,
            difficulty: 'easy',
            subredditName: SUBREDDIT,
        }
        const result = formatShareText(input)

        expect(result.gridText).toBe(formatGridAsText(sampleGrid))
        expect(result.text).toContain(result.gridText)
    })

    it('formats easy difficulty correctly', () => {
        const input: ShareTextInput = {
            grid: sampleGrid,
            dayNumber: 1,
            completionTime: 60,
            difficulty: 'easy',
            subredditName: SUBREDDIT,
        }
        const result = formatShareText(input)

        expect(result.text).toContain('🎯 Easy')
    })

    it('formats hard difficulty correctly', () => {
        const input: ShareTextInput = {
            grid: sampleGrid,
            dayNumber: 100,
            completionTime: 300,
            difficulty: 'hard',
            subredditName: SUBREDDIT,
        }
        const result = formatShareText(input)

        expect(result.text).toContain('🎯 Hard')
    })

    it('formats day number correctly for single digit', () => {
        const input: ShareTextInput = {
            grid: sampleGrid,
            dayNumber: 1,
            completionTime: 0,
            difficulty: 'easy',
            subredditName: SUBREDDIT,
        }
        const result = formatShareText(input)

        expect(result.text).toContain('Binary Grid #1 🧩')
    })

    it('formats day number correctly for triple digit', () => {
        const input: ShareTextInput = {
            grid: sampleGrid,
            dayNumber: 999,
            completionTime: 0,
            difficulty: 'easy',
            subredditName: SUBREDDIT,
        }
        const result = formatShareText(input)

        expect(result.text).toContain('Binary Grid #999 🧩')
    })

    it('produces text with correct line structure', () => {
        const input: ShareTextInput = {
            grid: sampleGrid,
            dayNumber: 47,
            completionTime: 154,
            difficulty: 'medium',
            subredditName: SUBREDDIT,
        }
        const result = formatShareText(input)
        const lines = result.text.split('\n')

        // Header, time line, empty, 6 grid rows, empty, footer = 11 lines
        expect(lines).toHaveLength(11)
        expect(lines[0]).toBe('Binary Grid #47 🧩')
        expect(lines[1]).toBe('⏱️ 02:34 | 🎯 Medium')
        expect(lines[2]).toBe('')
        expect(lines[9]).toBe('')
        expect(lines[10]).toBe(`Play at r/${SUBREDDIT}`)
    })
})


/**
 * Property-Based Tests: Time Format Round-Trip
 *
 * **Feature: shareable-results, Property 4: Time format round-trip**
 * **Validates: Requirements 1.4**
 */
describe('Property-Based Tests: formatTime round-trip', () => {
    /**
     * Parses a MM:SS formatted time string back to seconds.
     * Used to verify round-trip property of formatTime.
     *
     * @param timeStr - Time string in MM:SS format
     * @returns Number of seconds
     */
    const parseTime = (timeStr: string): number => {
        const [minsStr, secsStr] = timeStr.split(':')
        const mins = Number.parseInt(minsStr, 10)
        const secs = Number.parseInt(secsStr, 10)
        return mins * 60 + secs
    }

    /**
     * Arbitrary for generating non-negative integers representing seconds.
     * Constrained to < 6000 seconds (100 minutes) as per design spec.
     */
    const secondsArbitrary = fc.integer({ min: 0, max: 5999 })

    it('Property 4: Time format round-trip - formatting and parsing back produces original value', () => {
        /**
         * **Feature: shareable-results, Property 4: Time format round-trip**
         * **Validates: Requirements 1.4**
         *
         * For any non-negative integer representing seconds, formatting to MM:SS
         * and parsing back SHALL produce the original value (for values < 6000 seconds / 100 minutes).
         */
        fc.assert(
            fc.property(secondsArbitrary, (seconds) => {
                const formatted = formatTime(seconds)
                const parsed = parseTime(formatted)

                expect(parsed).toBe(seconds)
            }),
            { numRuns: 100 }
        )
    })

    it('Property 4: Time format round-trip - formatted output matches MM:SS pattern', () => {
        /**
         * **Feature: shareable-results, Property 4: Time format round-trip**
         * **Validates: Requirements 1.4**
         *
         * For any non-negative integer representing seconds (< 6000),
         * the formatted output SHALL match the MM:SS pattern with proper padding.
         */
        fc.assert(
            fc.property(secondsArbitrary, (seconds) => {
                const formatted = formatTime(seconds)

                // Should match pattern: two or more digits, colon, exactly two digits
                const pattern = /^\d{2,}:\d{2}$/
                expect(formatted).toMatch(pattern)
            }),
            { numRuns: 100 }
        )
    })

    it('Property 4: Time format round-trip - seconds component is always 0-59', () => {
        /**
         * **Feature: shareable-results, Property 4: Time format round-trip**
         * **Validates: Requirements 1.4**
         *
         * For any non-negative integer representing seconds,
         * the seconds component in MM:SS SHALL always be in range 0-59.
         */
        fc.assert(
            fc.property(secondsArbitrary, (seconds) => {
                const formatted = formatTime(seconds)
                const secsStr = formatted.split(':')[1]
                const secs = Number.parseInt(secsStr, 10)

                expect(secs).toBeGreaterThanOrEqual(0)
                expect(secs).toBeLessThanOrEqual(59)
            }),
            { numRuns: 100 }
        )
    })

    it('Property 4: Time format round-trip - minutes component equals floor division', () => {
        /**
         * **Feature: shareable-results, Property 4: Time format round-trip**
         * **Validates: Requirements 1.4**
         *
         * For any non-negative integer representing seconds,
         * the minutes component SHALL equal Math.floor(seconds / 60).
         */
        fc.assert(
            fc.property(secondsArbitrary, (seconds) => {
                const formatted = formatTime(seconds)
                const minsStr = formatted.split(':')[0]
                const mins = Number.parseInt(minsStr, 10)

                expect(mins).toBe(Math.floor(seconds / 60))
            }),
            { numRuns: 100 }
        )
    })
})

/**
 * Property-Based Tests: Day Number Format Validation
 *
 * **Feature: shareable-results, Property 3: Day number format validation**
 * **Validates: Requirements 1.3**
 */
describe('Property-Based Tests: Day number format validation', () => {
    /**
     * Arbitrary for generating positive integers representing day numbers.
     * Day numbers start at 1 and can grow indefinitely.
     */
    const dayNumberArbitrary = fc.integer({ min: 1, max: 999999 })

    /**
     * Sample grid for testing - we only care about the header format,
     * so the grid content doesn't matter for these tests.
     */
    const sampleGrid: Grid = [
        [0, 1, 0, 1, 1, 0],
        [1, 0, 1, 0, 0, 1],
        [0, 1, 1, 0, 1, 0],
        [1, 0, 0, 1, 0, 1],
        [0, 1, 0, 1, 1, 0],
        [1, 0, 1, 0, 0, 1],
    ]

    it('Property 3: Day number format validation - header matches exact pattern "Binary Grid #N 🧩"', () => {
        /**
         * **Feature: shareable-results, Property 3: Day number format validation**
         * **Validates: Requirements 1.3**
         *
         * For any positive integer day number N, the formatted header
         * SHALL match the pattern "Binary Grid #N 🧩" exactly.
         */
        fc.assert(
            fc.property(dayNumberArbitrary, (dayNumber) => {
                const input: ShareTextInput = {
                    grid: sampleGrid,
                    dayNumber,
                    completionTime: 0,
                    difficulty: 'easy',
                    subredditName: SUBREDDIT,
                }
                const result = formatShareText(input)
                const lines = result.text.split('\n')
                const header = lines[0]

                const expectedHeader = `Binary Grid #${dayNumber} 🧩`
                expect(header).toBe(expectedHeader)
            }),
            { numRuns: 100 }
        )
    })

    it('Property 3: Day number format validation - header is always the first line', () => {
        /**
         * **Feature: shareable-results, Property 3: Day number format validation**
         * **Validates: Requirements 1.3**
         *
         * For any positive integer day number N, the header "Binary Grid #N 🧩"
         * SHALL always appear as the first line of the share text.
         */
        fc.assert(
            fc.property(dayNumberArbitrary, (dayNumber) => {
                const input: ShareTextInput = {
                    grid: sampleGrid,
                    dayNumber,
                    completionTime: 0,
                    difficulty: 'easy',
                    subredditName: SUBREDDIT,
                }
                const result = formatShareText(input)

                expect(result.text.startsWith(`Binary Grid #${dayNumber} 🧩`)).toBe(true)
            }),
            { numRuns: 100 }
        )
    })

    it('Property 3: Day number format validation - day number is preserved exactly', () => {
        /**
         * **Feature: shareable-results, Property 3: Day number format validation**
         * **Validates: Requirements 1.3**
         *
         * For any positive integer day number N, the number in the header
         * SHALL be exactly N (no leading zeros, no formatting changes).
         */
        fc.assert(
            fc.property(dayNumberArbitrary, (dayNumber) => {
                const input: ShareTextInput = {
                    grid: sampleGrid,
                    dayNumber,
                    completionTime: 0,
                    difficulty: 'easy',
                    subredditName: SUBREDDIT,
                }
                const result = formatShareText(input)
                const header = result.text.split('\n')[0]

                // Extract the number from the header using regex
                const match = header.match(/Binary Grid #(\d+) 🧩/)
                expect(match).not.toBeNull()
                expect(Number.parseInt(match![1], 10)).toBe(dayNumber)
            }),
            { numRuns: 100 }
        )
    })
})

/**
 * Property-Based Tests
 *
 * **Feature: shareable-results, Property 2: Grid cells map to correct Unicode characters**
 * **Validates: Requirements 1.2, 2.2**
 */
describe('Property-Based Tests: formatGridAsText', () => {
    /**
     * Arbitrary for generating a 6x6 grid of 0s and 1s.
     * Constrains to valid completed puzzle grids (no null cells).
     */
    const gridArbitrary = fc.array(
        fc.array(fc.constantFrom(0, 1) as fc.Arbitrary<0 | 1>, { minLength: 6, maxLength: 6 }),
        { minLength: 6, maxLength: 6 }
    ) as fc.Arbitrary<Grid>

    it('Property 2: Grid cells map to correct Unicode characters - every 0 maps to ⬜ and every 1 maps to 🟩', () => {
        /**
         * **Feature: shareable-results, Property 2: Grid cells map to correct Unicode characters**
         * **Validates: Requirements 1.2, 2.2**
         *
         * For any 6×6 grid of 0s and 1s, the grid formatter SHALL produce a string
         * where every 0 maps to ⬜ and every 1 maps to 🟩.
         */
        fc.assert(
            fc.property(gridArbitrary, (grid) => {
                const result = formatGridAsText(grid)
                const rows = result.split('\n')

                // Verify each cell maps to the correct character
                for (let r = 0; r < 6; r++) {
                    const rowChars = [...rows[r]]
                    for (let c = 0; c < 6; c++) {
                        const cell = grid[r][c]
                        const expectedChar = cell === 0 ? '⬜' : '🟩'
                        expect(rowChars[c]).toBe(expectedChar)
                    }
                }
            }),
            { numRuns: 100 }
        )
    })

    it('Property 2: Grid cells map to correct Unicode characters - exactly 6 characters per row', () => {
        /**
         * **Feature: shareable-results, Property 2: Grid cells map to correct Unicode characters**
         * **Validates: Requirements 1.2, 2.2**
         *
         * For any 6×6 grid of 0s and 1s, the grid formatter SHALL produce a string
         * with exactly 6 characters per row.
         */
        fc.assert(
            fc.property(gridArbitrary, (grid) => {
                const result = formatGridAsText(grid)
                const rows = result.split('\n')

                for (const row of rows) {
                    // Use spread to count actual characters (handles multi-byte emoji)
                    const charCount = [...row].length
                    expect(charCount).toBe(6)
                }
            }),
            { numRuns: 100 }
        )
    })

    it('Property 2: Grid cells map to correct Unicode characters - exactly 6 rows total', () => {
        /**
         * **Feature: shareable-results, Property 2: Grid cells map to correct Unicode characters**
         * **Validates: Requirements 1.2, 2.2**
         *
         * For any 6×6 grid of 0s and 1s, the grid formatter SHALL produce a string
         * with exactly 6 rows total.
         */
        fc.assert(
            fc.property(gridArbitrary, (grid) => {
                const result = formatGridAsText(grid)
                const rows = result.split('\n')

                expect(rows).toHaveLength(6)
            }),
            { numRuns: 100 }
        )
    })

    it('Property 2: Grid cells map to correct Unicode characters - only contains valid characters', () => {
        /**
         * **Feature: shareable-results, Property 2: Grid cells map to correct Unicode characters**
         * **Validates: Requirements 1.2, 2.2**
         *
         * For any 6×6 grid of 0s and 1s, the grid formatter SHALL produce a string
         * containing only ⬜ and 🟩 characters (plus newlines).
         */
        fc.assert(
            fc.property(gridArbitrary, (grid) => {
                const result = formatGridAsText(grid)
                const validChars = new Set(['⬜', '🟩', '\n'])

                for (const char of result) {
                    expect(validChars.has(char)).toBe(true)
                }
            }),
            { numRuns: 100 }
        )
    })
})


/**
 * Property-Based Tests: Share Text Completeness
 *
 * **Feature: shareable-results, Property 1: Share text contains all required sections**
 * **Validates: Requirements 1.1, 2.3**
 */
describe('Property-Based Tests: Share text completeness', () => {
    /**
     * Arbitrary for generating a 6x6 grid of 0s and 1s.
     * Constrains to valid completed puzzle grids (no null cells).
     */
    const gridArbitrary = fc.array(
        fc.array(fc.constantFrom(0, 1) as fc.Arbitrary<0 | 1>, { minLength: 6, maxLength: 6 }),
        { minLength: 6, maxLength: 6 }
    ) as fc.Arbitrary<Grid>

    /**
     * Arbitrary for generating positive integers representing day numbers.
     */
    const dayNumberArbitrary = fc.integer({ min: 1, max: 999999 })

    /**
     * Arbitrary for generating non-negative integers representing seconds.
     * Constrained to < 6000 seconds (100 minutes) as per design spec.
     */
    const completionTimeArbitrary = fc.integer({ min: 0, max: 5999 })

    /**
     * Arbitrary for generating valid difficulty values.
     */
    const difficultyArbitrary = fc.constantFrom('easy', 'medium', 'hard') as fc.Arbitrary<Difficulty>

    /**
     * Arbitrary for generating valid ShareTextInput objects.
     */
    const shareTextInputArbitrary = fc.record({
        grid: gridArbitrary,
        dayNumber: dayNumberArbitrary,
        completionTime: completionTimeArbitrary,
        difficulty: difficultyArbitrary,
        subredditName: subredditArbitrary,
    })

    it('Property 1: Share text contains all required sections - contains day number header', () => {
        /**
         * **Feature: shareable-results, Property 1: Share text contains all required sections**
         * **Validates: Requirements 1.1, 2.3**
         *
         * For any valid completed puzzle state, the formatted share text
         * SHALL contain the day number header in format "Binary Grid #N 🧩".
         */
        fc.assert(
            fc.property(shareTextInputArbitrary, (input) => {
                const result = formatShareText(input)
                const expectedHeader = `Binary Grid #${input.dayNumber} 🧩`

                expect(result.text).toContain(expectedHeader)
            }),
            { numRuns: 100 }
        )
    })

    it('Property 1: Share text contains all required sections - contains time and difficulty line', () => {
        /**
         * **Feature: shareable-results, Property 1: Share text contains all required sections**
         * **Validates: Requirements 1.1, 2.3**
         *
         * For any valid completed puzzle state, the formatted share text
         * SHALL contain the time and difficulty line in format "⏱️ MM:SS | 🎯 Difficulty".
         */
        const difficultyLabels: Record<Difficulty, string> = {
            easy: 'Easy',
            medium: 'Medium',
            hard: 'Hard',
        }

        fc.assert(
            fc.property(shareTextInputArbitrary, (input) => {
                const result = formatShareText(input)
                const formattedTime = formatTime(input.completionTime)
                const difficultyLabel = difficultyLabels[input.difficulty]
                const expectedTimeLine = `⏱️ ${formattedTime} | 🎯 ${difficultyLabel}`

                expect(result.text).toContain(expectedTimeLine)
            }),
            { numRuns: 100 }
        )
    })

    it('Property 1: Share text contains all required sections - contains complete grid representation', () => {
        /**
         * **Feature: shareable-results, Property 1: Share text contains all required sections**
         * **Validates: Requirements 1.1, 2.3**
         *
         * For any valid completed puzzle state, the formatted share text
         * SHALL contain the complete grid representation (6 rows of emoji).
         */
        fc.assert(
            fc.property(shareTextInputArbitrary, (input) => {
                const result = formatShareText(input)
                const expectedGridText = formatGridAsText(input.grid)

                expect(result.text).toContain(expectedGridText)
                expect(result.gridText).toBe(expectedGridText)
            }),
            { numRuns: 100 }
        )
    })

    it('Property 1: Share text contains all required sections - contains play link', () => {
        /**
         * **Feature: shareable-results, Property 1: Share text contains all required sections**
         * **Validates: Requirements 1.1, 2.3**
         *
         * For any valid completed puzzle state, the formatted share text
         * SHALL contain the play link "Play at r/{subredditName}" for the install's subreddit.
         */
        fc.assert(
            fc.property(shareTextInputArbitrary, (input) => {
                const result = formatShareText(input)

                expect(result.text).toContain(`Play at r/${input.subredditName}`)
            }),
            { numRuns: 100 }
        )
    })

    it('Property 1: Share text contains all required sections - sections are separated by newlines', () => {
        /**
         * **Feature: shareable-results, Property 1: Share text contains all required sections**
         * **Validates: Requirements 1.1, 2.3**
         *
         * For any valid completed puzzle state, the formatted share text
         * SHALL have all sections separated by newlines with proper structure:
         * - Header on line 1
         * - Time/difficulty on line 2
         * - Empty line 3
         * - Grid on lines 4-9
         * - Empty line 10
         * - Play link on line 11
         */
        fc.assert(
            fc.property(shareTextInputArbitrary, (input) => {
                const result = formatShareText(input)
                const lines = result.text.split('\n')

                // Total structure: header, time, empty, 6 grid rows, empty, footer = 11 lines
                expect(lines).toHaveLength(11)

                // Line 1: Header
                expect(lines[0]).toBe(`Binary Grid #${input.dayNumber} 🧩`)

                // Line 2: Time and difficulty
                expect(lines[1]).toMatch(/^⏱️ \d{2,}:\d{2} \| 🎯 (Easy|Medium|Hard)$/)

                // Line 3: Empty separator
                expect(lines[2]).toBe('')

                // Lines 4-9: Grid (6 rows)
                const gridLines = lines.slice(3, 9)
                expect(gridLines).toHaveLength(6)
                for (const gridLine of gridLines) {
                    // Each grid line should have exactly 6 emoji characters
                    const chars = [...gridLine]
                    expect(chars).toHaveLength(6)
                    for (const char of chars) {
                        expect(['⬜', '🟩']).toContain(char)
                    }
                }

                // Line 10: Empty separator
                expect(lines[9]).toBe('')

                // Line 11: Footer
                expect(lines[10]).toBe(`Play at r/${input.subredditName}`)
            }),
            { numRuns: 100 }
        )
    })

    it('Property 1: Share text contains all required sections - all sections present in single output', () => {
        /**
         * **Feature: shareable-results, Property 1: Share text contains all required sections**
         * **Validates: Requirements 1.1, 2.3**
         *
         * For any valid completed puzzle state, the formatted share text
         * SHALL contain ALL required sections in a single output:
         * day number header, time and difficulty line, complete grid representation, and play link.
         */
        const difficultyLabels: Record<Difficulty, string> = {
            easy: 'Easy',
            medium: 'Medium',
            hard: 'Hard',
        }

        fc.assert(
            fc.property(shareTextInputArbitrary, (input) => {
                const result = formatShareText(input)

                // Check all required sections are present
                const hasHeader = result.text.includes(`Binary Grid #${input.dayNumber} 🧩`)
                const formattedTime = formatTime(input.completionTime)
                const hasTimeLine = result.text.includes(`⏱️ ${formattedTime} | 🎯 ${difficultyLabels[input.difficulty]}`)
                const hasGrid = result.text.includes(formatGridAsText(input.grid))
                const hasPlayLink = result.text.includes(`Play at r/${input.subredditName}`)

                expect(hasHeader).toBe(true)
                expect(hasTimeLine).toBe(true)
                expect(hasGrid).toBe(true)
                expect(hasPlayLink).toBe(true)
            }),
            { numRuns: 100 }
        )
    })
})

describe('formatScoreShareText', () => {
    const request: ScoreShareRequest = {
        dayNumber: 128,
        solveTimeSeconds: 134,
        difficulty: 'medium',
    }

    it('writes one plain line with the puzzle number, time and difficulty', () => {
        expect(formatScoreShareText(request)).toBe('Solved Binary Grid #128 in 02:14 | Medium')
    })

    it('adds the streak once it reaches two days', () => {
        expect(formatScoreShareText({ ...request, streak: 1 })).toBe(
            'Solved Binary Grid #128 in 02:14 | Medium'
        )
        expect(formatScoreShareText({ ...request, streak: 5 })).toBe(
            'Solved Binary Grid #128 in 02:14 | Medium | 5-day streak'
        )
    })

    it('folds a streak milestone into the same line', () => {
        expect(formatScoreShareText({ ...request, streak: 30 })).toBe(
            'Solved Binary Grid #128 in 02:14 | Medium | 30-day streak milestone'
        )
    })

    it('adds the board rank when one is given', () => {
        expect(formatScoreShareText({ ...request, streak: 5, rank: 3 })).toBe(
            'Solved Binary Grid #128 in 02:14 | Medium | 5-day streak | rank #3'
        )
    })

    it('puts the template line in its own paragraph', () => {
        expect(formatScoreShareText({ ...request, streak: 5, templateId: 'beat_time' })).toBe(
            'Solved Binary Grid #128 in 02:14 | Medium | 5-day streak\n\nBeat my time: 02:14.'
        )
    })

    it("uses the player's own words instead of the template line", () => {
        const text = formatScoreShareText({
            ...request,
            templateId: 'beat_time',
            customText: '  Loved the corner trick.  ',
        })

        expect(text).toBe('Solved Binary Grid #128 in 02:14 | Medium\n\nLoved the corner trick.')
    })

    it('keeps the template line when the own words are blank', () => {
        expect(formatScoreShareText({ ...request, templateId: 'beat_time', customText: '   ' })).toBe(
            'Solved Binary Grid #128 in 02:14 | Medium\n\nBeat my time: 02:14.'
        )
    })

    it('never spoils the grid or names a solve label', () => {
        // Solve labels stay out of shared text until the Clean label can be earned (task 3)
        const requestArbitrary = fc.record({
            dayNumber: fc.integer({ min: 1, max: 999999 }),
            solveTimeSeconds: fc.integer({ min: 0, max: 5999 }),
            difficulty: fc.constantFrom<Difficulty>('easy', 'medium', 'hard'),
            streak: fc.integer({ min: 0, max: 400 }),
            templateId: fc.constantFrom<ShareTemplateId>('beat_time', 'pure_logic', 'streak_save'),
        })

        fc.assert(
            fc.property(requestArbitrary, (generated) => {
                const text = formatScoreShareText(generated)

                expect(text).not.toMatch(/[⬜🟩⬛]/u)
                expect(text).not.toMatch(/Clean|Sharp|Comeback|Assisted/)
            }),
            { numRuns: 100 }
        )
    })
})

describe('getShareMode', () => {
    it("replies in the score thread without the player's own words", () => {
        expect(getShareMode({})).toBe('scoreThread')
        expect(getShareMode({ customText: '   ' })).toBe('scoreThread')
    })

    it('posts top-level when the player adds their own words', () => {
        expect(getShareMode({ customText: 'Fun one' })).toBe('customTopLevel')
    })
})
