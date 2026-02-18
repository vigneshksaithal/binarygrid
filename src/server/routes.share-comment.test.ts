/**
 * Property-Based Tests: Share Comment Idempotency
 *
 * **Feature: shareable-results, Property 5: Share comment idempotency**
 * **Validates: Requirements 4.4**
 *
 * Tests that the share comment endpoint is idempotent - multiple calls
 * with the same user/puzzle combination result in at most one comment.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as fc from 'fast-check'
import type { Difficulty, Grid } from '../shared/types/puzzle'

// Mock the @devvit/web/server module
vi.mock('@devvit/web/server', () => {
    const redisStore = new Map<string, string>()

    return {
        redis: {
            get: vi.fn((key: string) => Promise.resolve(redisStore.get(key) ?? null)),
            set: vi.fn((key: string, value: string) => {
                redisStore.set(key, value)
                return Promise.resolve()
            }),
            // Expose store for test inspection
            __store: redisStore,
            __clearStore: () => redisStore.clear(),
        },
        reddit: {
            submitComment: vi.fn(() => Promise.resolve({ id: 'comment_123' })),
        },
        context: {
            postId: 'test_post_123',
            userId: 'test_user_456',
        },
        cache: vi.fn((fn: () => Promise<unknown>) => fn()),
    }
})

// Import after mocking
import app from './routes/index'
import { redis, reddit, context } from '@devvit/web/server'

/**
 * Helper to create a valid 6x6 grid of 0s and 1s.
 */
const createValidGrid = (): Grid => [
    [0, 1, 0, 1, 1, 0],
    [1, 0, 1, 0, 0, 1],
    [0, 1, 1, 0, 1, 0],
    [1, 0, 0, 1, 0, 1],
    [0, 1, 0, 1, 1, 0],
    [1, 0, 1, 0, 0, 1],
]

/**
 * Helper to make a share comment request.
 */
const makeShareCommentRequest = async (body: {
    solveTimeSeconds: number
    difficulty: Difficulty
    dayNumber: number
    grid: Grid
}) => {
    const request = new Request('http://localhost/api/share-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    return app.fetch(request)
}

describe('Property-Based Tests: Share comment idempotency', () => {
    beforeEach(() => {
        // Clear mocks and Redis store before each test
        vi.clearAllMocks()
        const redisModule = redis as unknown as {
            __store: Map<string, string>
            __clearStore: () => void
        }
        redisModule.__clearStore()
    })

    /**
     * Arbitrary for generating valid solve times (0 to 5999 seconds).
     */
    const solveTimeArbitrary = fc.integer({ min: 0, max: 5999 })

    /**
     * Arbitrary for generating valid day numbers (positive integers).
     */
    const dayNumberArbitrary = fc.integer({ min: 1, max: 999999 })

    /**
     * Arbitrary for generating valid difficulty values.
     */
    const difficultyArbitrary = fc.constantFrom('easy', 'medium', 'hard') as fc.Arbitrary<Difficulty>

    /**
     * Arbitrary for generating a 6x6 grid of 0s and 1s.
     */
    const gridArbitrary = fc.array(
        fc.array(fc.constantFrom(0, 1) as fc.Arbitrary<0 | 1>, { minLength: 6, maxLength: 6 }),
        { minLength: 6, maxLength: 6 }
    ) as fc.Arbitrary<Grid>

    /**
     * Arbitrary for generating valid share comment request bodies.
     */
    const shareRequestArbitrary = fc.record({
        solveTimeSeconds: solveTimeArbitrary,
        difficulty: difficultyArbitrary,
        dayNumber: dayNumberArbitrary,
        grid: gridArbitrary,
    })

    /**
     * Arbitrary for generating the number of duplicate calls (2 to 5).
     */
    const callCountArbitrary = fc.integer({ min: 2, max: 5 })

    it('Property 5: Share comment idempotency - multiple calls result in exactly one Reddit comment', async () => {
        /**
         * **Feature: shareable-results, Property 5: Share comment idempotency**
         * **Validates: Requirements 4.4**
         *
         * For any user and puzzle combination, calling the share comment endpoint
         * multiple times SHALL result in at most one comment being posted.
         */
        await fc.assert(
            fc.asyncProperty(
                shareRequestArbitrary,
                callCountArbitrary,
                async (requestBody, callCount) => {
                    // Clear state before each property iteration
                    vi.clearAllMocks()
                    const redisModule = redis as unknown as {
                        __store: Map<string, string>
                        __clearStore: () => void
                    }
                    redisModule.__clearStore()

                    // Make multiple identical requests
                    const responses: Response[] = []
                    for (let i = 0; i < callCount; i++) {
                        const response = await makeShareCommentRequest(requestBody)
                        responses.push(response)
                    }

                    // All responses should be successful
                    for (const response of responses) {
                        expect(response.status).toBe(200)
                        const json = await response.json()
                        expect(json.ok).toBe(true)
                    }

                    // Reddit submitComment should be called exactly once
                    expect(reddit.submitComment).toHaveBeenCalledTimes(1)
                }
            ),
            { numRuns: 100 }
        )
    })

    it('Property 5: Share comment idempotency - first call posts comment, subsequent calls are no-ops', async () => {
        /**
         * **Feature: shareable-results, Property 5: Share comment idempotency**
         * **Validates: Requirements 4.4**
         *
         * For any user and puzzle combination, the first call SHALL post a comment
         * and subsequent calls SHALL be no-ops (not posting additional comments).
         */
        await fc.assert(
            fc.asyncProperty(shareRequestArbitrary, async (requestBody) => {
                // Clear state before each property iteration
                vi.clearAllMocks()
                const redisModule = redis as unknown as {
                    __store: Map<string, string>
                    __clearStore: () => void
                }
                redisModule.__clearStore()

                // First call
                const firstResponse = await makeShareCommentRequest(requestBody)
                expect(firstResponse.status).toBe(200)
                const firstJson = await firstResponse.json()
                expect(firstJson.ok).toBe(true)

                // Verify first call posted a comment
                expect(reddit.submitComment).toHaveBeenCalledTimes(1)

                // Second call
                const secondResponse = await makeShareCommentRequest(requestBody)
                expect(secondResponse.status).toBe(200)
                const secondJson = await secondResponse.json()
                expect(secondJson.ok).toBe(true)

                // Verify second call did NOT post another comment
                expect(reddit.submitComment).toHaveBeenCalledTimes(1)
            }),
            { numRuns: 100 }
        )
    })

    it('Property 5: Share comment idempotency - Redis tracks share state correctly', async () => {
        /**
         * **Feature: shareable-results, Property 5: Share comment idempotency**
         * **Validates: Requirements 4.4**
         *
         * For any user and puzzle combination, after the first successful share,
         * Redis SHALL contain a tracking key that prevents duplicate shares.
         */
        await fc.assert(
            fc.asyncProperty(shareRequestArbitrary, async (requestBody) => {
                // Clear state before each property iteration
                vi.clearAllMocks()
                const redisModule = redis as unknown as {
                    __store: Map<string, string>
                    __clearStore: () => void
                }
                redisModule.__clearStore()

                // Before first call, Redis should have no share tracking key
                expect(redisModule.__store.size).toBe(0)

                // First call
                await makeShareCommentRequest(requestBody)

                // After first call, Redis should have exactly one share tracking key
                expect(redisModule.__store.size).toBe(1)

                // The key should follow the pattern: share:comment:{postId}:{puzzleId}:{userId}
                const keys = Array.from(redisModule.__store.keys())
                expect(keys[0]).toMatch(/^share:comment:/)
                expect(redisModule.__store.get(keys[0])).toBe('1')
            }),
            { numRuns: 100 }
        )
    })

    it('Property 5: Share comment idempotency - different puzzles get separate comments', async () => {
        /**
         * **Feature: shareable-results, Property 5: Share comment idempotency**
         * **Validates: Requirements 4.4**
         *
         * For any user, different puzzle combinations (different difficulty)
         * SHALL each result in their own comment being posted.
         */
        await fc.assert(
            fc.asyncProperty(
                solveTimeArbitrary,
                dayNumberArbitrary,
                gridArbitrary,
                async (solveTime, dayNumber, grid) => {
                    // Clear state before each property iteration
                    vi.clearAllMocks()
                    const redisModule = redis as unknown as {
                        __store: Map<string, string>
                        __clearStore: () => void
                    }
                    redisModule.__clearStore()

                    // Share for easy difficulty
                    const easyRequest = {
                        solveTimeSeconds: solveTime,
                        difficulty: 'easy' as Difficulty,
                        dayNumber,
                        grid,
                    }
                    await makeShareCommentRequest(easyRequest)

                    // Share for medium difficulty (different puzzle)
                    const mediumRequest = {
                        solveTimeSeconds: solveTime,
                        difficulty: 'medium' as Difficulty,
                        dayNumber,
                        grid,
                    }
                    await makeShareCommentRequest(mediumRequest)

                    // Share for hard difficulty (different puzzle)
                    const hardRequest = {
                        solveTimeSeconds: solveTime,
                        difficulty: 'hard' as Difficulty,
                        dayNumber,
                        grid,
                    }
                    await makeShareCommentRequest(hardRequest)

                    // Each difficulty should result in a separate comment
                    expect(reddit.submitComment).toHaveBeenCalledTimes(3)

                    // Redis should have 3 separate tracking keys
                    expect(redisModule.__store.size).toBe(3)
                }
            ),
            { numRuns: 100 }
        )
    })

    it('Property 5: Share comment idempotency - idempotent responses are identical', async () => {
        /**
         * **Feature: shareable-results, Property 5: Share comment idempotency**
         * **Validates: Requirements 4.4**
         *
         * For any user and puzzle combination, all calls (first and subsequent)
         * SHALL return the same successful response structure.
         */
        await fc.assert(
            fc.asyncProperty(
                shareRequestArbitrary,
                callCountArbitrary,
                async (requestBody, callCount) => {
                    // Clear state before each property iteration
                    vi.clearAllMocks()
                    const redisModule = redis as unknown as {
                        __store: Map<string, string>
                        __clearStore: () => void
                    }
                    redisModule.__clearStore()

                    // Collect all responses
                    const jsonResponses: Array<{ ok: boolean }> = []
                    for (let i = 0; i < callCount; i++) {
                        const response = await makeShareCommentRequest(requestBody)
                        const json = await response.json()
                        jsonResponses.push(json)
                    }

                    // All responses should have identical structure
                    for (const json of jsonResponses) {
                        expect(json).toEqual({ ok: true })
                    }
                }
            ),
            { numRuns: 100 }
        )
    })
})
