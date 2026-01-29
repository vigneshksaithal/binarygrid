/**
 * Clipboard service for copying text to the system clipboard.
 * Handles clipboard API availability and errors gracefully.
 */

export interface CopyResult {
    success: boolean
    error?: string
}

/**
 * Copies the provided text to the system clipboard.
 *
 * @param text - The text to copy to clipboard
 * @returns A CopyResult indicating success or failure with error details
 *
 * Error handling:
 * - Clipboard API unavailable: Returns error message for manual copy fallback
 * - Clipboard write fails: Returns error message with retry option
 * - Permission denied: Returns error explaining clipboard permission requirement
 */
export const copyToClipboard = async (text: string): Promise<CopyResult> => {
    // Check if clipboard API is available
    if (!navigator?.clipboard?.writeText) {
        return {
            success: false,
            error: 'Clipboard API is not available. Please copy the text manually.',
        }
    }

    try {
        await navigator.clipboard.writeText(text)
        return { success: true }
    } catch (err) {
        // Handle specific error types
        if (err instanceof Error) {
            // Permission denied errors
            if (err.name === 'NotAllowedError') {
                return {
                    success: false,
                    error:
                        'Clipboard access denied. Please allow clipboard permissions to copy.',
                }
            }

            // Generic clipboard write failure
            return {
                success: false,
                error: `Failed to copy to clipboard: ${err.message}. Please try again.`,
            }
        }

        // Unknown error type
        return {
            success: false,
            error: 'An unexpected error occurred while copying. Please try again.',
        }
    }
}
