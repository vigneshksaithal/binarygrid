# Implementation Plan: Shareable Results

## Overview

This plan implements the Shareable Results feature for Binary Grid, enabling players to share their puzzle completion with a spoiler-free visual representation. The implementation follows an incremental approach, starting with core formatting logic, then UI components, and finally API integration.

## Tasks

- [x] 1. Implement ShareTextFormatter module
  - [x] 1.1 Create share-formatter.ts in src/shared with formatShareText, formatGridAsText, and formatTime functions
    - Define ShareTextInput and ShareTextOutput interfaces
    - Implement grid-to-emoji mapping (0 → ⬜, 1 → 🟩)
    - Implement time formatting (seconds to MM:SS)
    - Implement full share text assembly with day number, time, difficulty, grid, and play link
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3_
  - [x] 1.2 Write property test for grid character mapping
    - **Property 2: Grid cells map to correct Unicode characters**
    - **Validates: Requirements 1.2, 2.2**
  - [x] 1.3 Write property test for time format round-trip
    - **Property 4: Time format round-trip**
    - **Validates: Requirements 1.4**
  - [x] 1.4 Write property test for day number format
    - **Property 3: Day number format validation**
    - **Validates: Requirements 1.3**
  - [x] 1.5 Write property test for share text completeness
    - **Property 1: Share text contains all required sections**
    - **Validates: Requirements 1.1, 2.3**

- [x] 2. Checkpoint - Ensure formatter tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement ClipboardService
  - [x] 3.1 Create clipboard.ts in src/client/services with copyToClipboard function
    - Implement async clipboard write using navigator.clipboard API
    - Return CopyResult with success/error status
    - Handle clipboard API unavailability gracefully
    - _Requirements: 3.1, 3.3_
  - [x] 3.2 Write unit tests for ClipboardService
    - Test successful copy scenario
    - Test error handling when API unavailable
    - _Requirements: 3.1, 3.3_

- [x] 4. Implement ShareCard component
  - [x] 4.1 Create ShareCard.svelte in src/client/components
    - Accept grid, dayNumber, completionTime, difficulty as props
    - Render spoiler-free grid using colored div squares matching emoji colors
    - Display formatted time, day number, and difficulty
    - Style to match Binary Grid brand aesthetic
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.1, 6.2, 6.3, 6.4_

- [x] 5. Implement share state management
  - [x] 5.1 Create share.ts store in src/client/stores
    - Define ShareState interface with isCopying, copySuccess, isSharing, shareSuccess, shareError
    - Implement copyResults action that uses ClipboardService and ShareTextFormatter
    - Implement shareToReddit action placeholder (API call in next task)
    - Implement reset functions for state cleanup
    - _Requirements: 3.1, 3.2, 4.1, 4.2_

- [x] 6. Implement server-side puzzle number tracking
  - [x] 6.1 Create puzzle-number.ts in src/server/core
    - Implement getPuzzleNumber(postId) to retrieve puzzle number from Redis
    - Implement getOrCreatePuzzleNumber(postId, dateISO) to assign sequential numbers
    - Use Redis counter for global puzzle numbering
    - _Requirements: 1.3_
  - [x] 6.2 Add puzzle number endpoint to routes.ts
    - GET /api/puzzle-number returns the day number for current post
    - _Requirements: 1.3_

- [x] 7. Checkpoint - Ensure core components work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement share comment API endpoint
  - [x] 8.1 Add POST /api/share-comment endpoint to routes.ts
    - Accept solveTimeSeconds, difficulty, dayNumber in request body
    - Generate share text using ShareTextFormatter
    - Post comment to Reddit using existing reddit.submitComment pattern
    - Track share in Redis to prevent duplicates
    - Return success/error response
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [x] 8.2 Write property test for share comment idempotency
    - **Property 5: Share comment idempotency**
    - **Validates: Requirements 4.4**

- [x] 9. Integrate ShareCard into SuccessModal
  - [x] 9.1 Update SuccessModal.svelte to include sharing functionality
    - Import and render ShareCard component with current game state
    - Add "Copy Results" button wired to share store copyResults action
    - Add "Share to Reddit" button wired to share store shareToReddit action
    - Display copy/share success/error feedback
    - Fetch puzzle day number on modal open
    - Maintain existing functionality (time, rank, change difficulty, join subreddit)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All test tasks are required for comprehensive coverage
- ShareTextFormatter is in src/shared for potential server-side use
- Property tests use fast-check library with minimum 100 iterations
- Emoji characters (⬜🟩) chosen for cross-platform compatibility
- Existing comment-score endpoint pattern reused for share-comment
