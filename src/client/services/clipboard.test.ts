import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copyToClipboard, type CopyResult } from './clipboard'

/**
 * Unit tests for ClipboardService
 *
 * Tests clipboard copy functionality including:
 * - Successful copy scenario
 * - Clipboard API unavailable
 * - Permission denied error
 * - Generic error handling
 *
 * **Validates: Requirements 3.1, 3.3**
 */
describe('copyToClipboard', () => {
    const originalNavigator = global.navigator

    beforeEach(() => {
        // Reset navigator before each test
        vi.stubGlobal('navigator', {
            clipboard: {
                writeText: vi.fn(),
            },
        })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    describe('successful copy scenario', () => {
        it('returns success when clipboard writeText resolves successfully', async () => {
            const mockWriteText = vi.fn().mockResolvedValue(undefined)
            vi.stubGlobal('navigator', {
                clipboard: {
                    writeText: mockWriteText,
                },
            })

            const result = await copyToClipboard('test text')

            expect(result.success).toBe(true)
            expect(result.error).toBeUndefined()
            expect(mockWriteText).toHaveBeenCalledWith('test text')
        })

        it('passes the exact text to clipboard API', async () => {
            const mockWriteText = vi.fn().mockResolvedValue(undefined)
            vi.stubGlobal('navigator', {
                clipboard: {
                    writeText: mockWriteText,
                },
            })

            const shareText = 'Binary Grid #47 🧩\n⏱️ 02:34 | 🎯 Medium\n\n⬜🟩⬜🟩🟩⬜'
            await copyToClipboard(shareText)

            expect(mockWriteText).toHaveBeenCalledWith(shareText)
        })

        it('handles empty string copy', async () => {
            const mockWriteText = vi.fn().mockResolvedValue(undefined)
            vi.stubGlobal('navigator', {
                clipboard: {
                    writeText: mockWriteText,
                },
            })

            const result = await copyToClipboard('')

            expect(result.success).toBe(true)
            expect(mockWriteText).toHaveBeenCalledWith('')
        })
    })

    describe('clipboard API unavailable', () => {
        it('returns error when navigator.clipboard is undefined', async () => {
            vi.stubGlobal('navigator', {
                clipboard: undefined,
            })

            const result = await copyToClipboard('test text')

            expect(result.success).toBe(false)
            expect(result.error).toBe(
                'Clipboard API is not available. Please copy the text manually.'
            )
        })

        it('returns error when navigator.clipboard.writeText is undefined', async () => {
            vi.stubGlobal('navigator', {
                clipboard: {},
            })

            const result = await copyToClipboard('test text')

            expect(result.success).toBe(false)
            expect(result.error).toBe(
                'Clipboard API is not available. Please copy the text manually.'
            )
        })

        it('returns error when navigator is undefined', async () => {
            vi.stubGlobal('navigator', undefined)

            const result = await copyToClipboard('test text')

            expect(result.success).toBe(false)
            expect(result.error).toBe(
                'Clipboard API is not available. Please copy the text manually.'
            )
        })
    })

    describe('permission denied error', () => {
        it('returns permission denied error when writeText throws NotAllowedError', async () => {
            const notAllowedError = new Error('Clipboard write was blocked')
            notAllowedError.name = 'NotAllowedError'

            const mockWriteText = vi.fn().mockRejectedValue(notAllowedError)
            vi.stubGlobal('navigator', {
                clipboard: {
                    writeText: mockWriteText,
                },
            })

            const result = await copyToClipboard('test text')

            expect(result.success).toBe(false)
            expect(result.error).toBe(
                'Clipboard access denied. Please allow clipboard permissions to copy.'
            )
        })
    })

    describe('generic error handling', () => {
        it('returns error message when writeText throws generic Error', async () => {
            const genericError = new Error('Something went wrong')
            const mockWriteText = vi.fn().mockRejectedValue(genericError)
            vi.stubGlobal('navigator', {
                clipboard: {
                    writeText: mockWriteText,
                },
            })

            const result = await copyToClipboard('test text')

            expect(result.success).toBe(false)
            expect(result.error).toBe(
                'Failed to copy to clipboard: Something went wrong. Please try again.'
            )
        })

        it('returns unexpected error message when writeText throws non-Error', async () => {
            const mockWriteText = vi.fn().mockRejectedValue('string error')
            vi.stubGlobal('navigator', {
                clipboard: {
                    writeText: mockWriteText,
                },
            })

            const result = await copyToClipboard('test text')

            expect(result.success).toBe(false)
            expect(result.error).toBe(
                'An unexpected error occurred while copying. Please try again.'
            )
        })

        it('returns unexpected error message when writeText throws null', async () => {
            const mockWriteText = vi.fn().mockRejectedValue(null)
            vi.stubGlobal('navigator', {
                clipboard: {
                    writeText: mockWriteText,
                },
            })

            const result = await copyToClipboard('test text')

            expect(result.success).toBe(false)
            expect(result.error).toBe(
                'An unexpected error occurred while copying. Please try again.'
            )
        })
    })
})
