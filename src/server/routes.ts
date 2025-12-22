import { cache, context, reddit, redis } from "@devvit/web/server";
import { Hono } from "hono";
import type {
	LeaderboardEntry,
	LeaderboardResponse,
} from "../shared/types/leaderboard";
import type { Difficulty, Grid, PuzzleWithGrid } from "../shared/types/puzzle";
import { validateGrid } from "../shared/validator";
import { generateDailyPuzzle } from "./core/generator";

const app = new Hono();

const HTTP_BAD_REQUEST = 400;
const HTTP_OK = 200;
const DEFAULT_GRID_SIZE = 6;
const DECIMAL_RADIX = 10;
const GRID_SIZE_TYPE = 6;
const DEFAULT_DIFFICULTY: Difficulty = "medium";
const DIFFICULTY_VALUES = ["easy", "medium", "hard"];
const LEADERBOARD_DEFAULT_PAGE_SIZE = 5;
const LEADERBOARD_MAX_PAGE_SIZE = 10;
const CACHE_TTL_ONE_DAY = 86400;

type StoredLeaderboardMeta = {
	username: string;
	avatarUrl: string | null;
};

const isDifficultyValue = (value: string): value is Difficulty =>
	(DIFFICULTY_VALUES as readonly string[]).includes(value);

const resolveDifficulty = (value: string | null): Difficulty => {
	if (!value) {
		return DEFAULT_DIFFICULTY;
	}
	const normalized = value.toLowerCase();
	return isDifficultyValue(normalized) ? normalized : DEFAULT_DIFFICULTY;
};

const todayISO = (): string => new Date().toISOString().slice(0, 10);

const resolveDate = (value: string | null): string => {
	if (!value) {
		return todayISO();
	}
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return todayISO();
	}
	return parsed.toISOString().slice(0, 10);
};

const leaderboardKey = (puzzleId: string): string => `leaderboard:${puzzleId}`;

const leaderboardMetaKey = (puzzleId: string): string =>
	`leaderboard:${puzzleId}:meta`;

const clampPageSize = (value: number | null | undefined): number => {
	if (!value || Number.isNaN(value)) {
		return LEADERBOARD_DEFAULT_PAGE_SIZE;
	}
	return Math.min(Math.max(value, 1), LEADERBOARD_MAX_PAGE_SIZE);
};

const parseLeaderboardMeta = (
	value: string | null | undefined,
): StoredLeaderboardMeta => {
	if (!value) {
		return { username: "Unknown player", avatarUrl: null };
	}
	try {
		const parsed = JSON.parse(value) as StoredLeaderboardMeta;
		if (
			typeof parsed.username === "string" &&
			(parsed.avatarUrl === null || typeof parsed.avatarUrl === "string")
		) {
			return parsed;
		}
	} catch {
		// ignore malformed JSON payloads
	}
	return { username: "Unknown player", avatarUrl: null };
};

app.get("/api/health", (c) => c.json({ ok: true }));

// Check if user has joined subreddit
app.get("/api/check-joined-status", async (c) => {
	const { userId } = context;
	if (!userId) {
		return c.json({ hasJoined: false });
	}

	try {
		const hasJoined = await redis.get(`user:${userId}:joined_subreddit`);
		return c.json({ hasJoined: hasJoined === "1" });
	} catch {
		return c.json({ hasJoined: false });
	}
});

// Join subreddit
app.post("/api/join-subreddit", async (c) => {
	const { userId } = context;
	if (!userId) {
		return c.json(
			{ status: "error", message: "Login required" },
			HTTP_BAD_REQUEST,
		);
	}

	try {
		await reddit.subscribeToCurrentSubreddit();
		await redis.set(`user:${userId}:joined_subreddit`, "1");
		return c.json({ ok: true });
	} catch (error) {
		return c.json(
			{ status: "error", message: `Failed to join subreddit. Error: ${error}` },
			HTTP_BAD_REQUEST,
		);
	}
});

// Format elapsed time in MM:SS format
const formatElapsedTime = (elapsed: number): string => {
	const minutes = Math.floor(elapsed / 60);
	const seconds = elapsed % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

// Comment score endpoint
app.post("/api/comment-score", async (c) => {
	const body = await c.req
		.json<{ solveTimeSeconds: number; difficulty: Difficulty }>()
		.catch(() => null);
	if (
		!body ||
		typeof body.solveTimeSeconds !== "number" ||
		typeof body.difficulty !== "string"
	) {
		return c.json({ error: "invalid payload" }, HTTP_BAD_REQUEST);
	}

	const solveTimeSeconds = Number(body.solveTimeSeconds);
	if (!Number.isFinite(solveTimeSeconds) || solveTimeSeconds < 0) {
		return c.json({ error: "invalid solve time" }, HTTP_BAD_REQUEST);
	}

	if (!isDifficultyValue(body.difficulty)) {
		return c.json({ error: "invalid difficulty" }, HTTP_BAD_REQUEST);
	}

	const { postId, userId } = context;
	if (!postId) {
		return c.json({ error: "postId is required" }, HTTP_BAD_REQUEST);
	}
	if (!userId) {
		return c.json({ error: "login required" }, HTTP_BAD_REQUEST);
	}

	try {
		const formattedTime = formatElapsedTime(solveTimeSeconds);
		const capitalizedDifficulty =
			body.difficulty.charAt(0).toUpperCase() + body.difficulty.slice(1);
		const commentText = `I solved today's Binary Grid puzzle on ${capitalizedDifficulty} difficulty in ${formattedTime}!`;

		// Ensure postId has t3_ prefix for Reddit API
		const postIdWithPrefix = postId.startsWith("t3_")
			? (postId as `t3_${string}`)
			: (`t3_${postId}` as `t3_${string}`);

		await reddit.submitComment({
			runAs: "USER",
			id: postIdWithPrefix,
			text: commentText,
		});

		return c.json({ ok: true });
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		return c.json(
			{ error: `Failed to post comment: ${errorMessage}` },
			HTTP_BAD_REQUEST,
		);
	}
});

// Get puzzle for the current post
app.get("/api/puzzle", async (c) => {
	try {
		const { postId } = context;
		const requestedDifficulty = resolveDifficulty(
			c.req.query("difficulty") ?? null,
		);
		let puzzle: PuzzleWithGrid | null = null;

		if (postId) {
			const puzzleData = await redis.hGetAll(
				`post:${postId}:puzzle:${requestedDifficulty}`,
			);

			if (puzzleData?.id) {
				puzzle = {
					id: puzzleData.id,
					size: Number.parseInt(
						puzzleData.size || DEFAULT_GRID_SIZE.toString(),
						DECIMAL_RADIX,
					) as typeof GRID_SIZE_TYPE,
					difficulty: resolveDifficulty(puzzleData.difficulty ?? null),
					fixed: JSON.parse(puzzleData.fixed || "[]"),
					initial: JSON.parse(puzzleData.initial || "[]"),
				};
			}
		}

		if (!puzzle) {
			const date = resolveDate(c.req.query("date") ?? null);
			const difficulty = requestedDifficulty;
			puzzle = await cache(async () => generateDailyPuzzle(date, difficulty), {
				key: `puzzle:cache:${date}:${difficulty}`,
				ttl: CACHE_TTL_ONE_DAY,
			});
		}

		// Increment play count for this post if postId exists
		if (postId) {
			try {
				await redis.incrBy(`playCount:${postId}`, 1);
			} catch {
				// Ignore errors - play count tracking is best effort
			}
		}

		return c.json({ puzzle });
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		return c.json(
			{ error: `Failed to fetch puzzle: ${errorMessage}` },
			HTTP_BAD_REQUEST,
		);
	}
});

app.get("/api/play-count", async (c) => {
	try {
		const { postId } = context;
		if (!postId) {
			return c.json({ count: 0 });
		}

		const countStr = await redis.get(`playCount:${postId}`);
		const count = countStr ? Number.parseInt(countStr, DECIMAL_RADIX) : 0;

		return c.json({ count: Number.isNaN(count) ? 0 : count });
	} catch (error) {
		// Return 0 on error - play count is best effort
		return c.json({ count: 0 });
	}
});

app.post("/api/submit", async (c) => {
	const body = await c.req
		.json<{ id: string; grid: Grid; solveTimeSeconds: number }>()
		.catch(() => null);
	if (
		!body ||
		typeof body.id !== "string" ||
		!Array.isArray(body.grid) ||
		typeof body.solveTimeSeconds !== "number"
	) {
		return c.json({ error: "invalid payload" }, HTTP_BAD_REQUEST);
	}

	const solveTimeSeconds = Number(body.solveTimeSeconds);
	if (!Number.isFinite(solveTimeSeconds) || solveTimeSeconds < 0) {
		return c.json({ error: "invalid solve time" }, HTTP_BAD_REQUEST);
	}

	const { postId, userId } = context;
	if (!postId) {
		return c.json({ error: "postId is required" }, HTTP_BAD_REQUEST);
	}
	if (!userId) {
		return c.json({ error: "login required" }, HTTP_BAD_REQUEST);
	}

	try {
		// Extract difficulty from puzzle ID (format: ${postId}:${difficulty} or ${dateISO}:${difficulty})
		const puzzleIdParts = body.id.split(":");
		const lastPart = puzzleIdParts[puzzleIdParts.length - 1];
		const difficulty =
			lastPart && isDifficultyValue(lastPart)
				? (lastPart as Difficulty)
				: DEFAULT_DIFFICULTY;

		// Fetch puzzle from Redis using new format
		let puzzleData = await redis.hGetAll(`post:${postId}:puzzle:${difficulty}`);

		// Fallback to old format for backward compatibility
		// Only use fallback if puzzle ID matches (prevents validating against wrong puzzle)
		if (!puzzleData?.id || puzzleData.id !== body.id) {
			const oldPuzzleData = await redis.hGetAll(`post:${postId}:puzzle`);
			// Verify the old puzzle ID matches the submission ID before using it
			if (oldPuzzleData?.id && oldPuzzleData.id === body.id) {
				puzzleData = oldPuzzleData;
			}
		}

		// Verify puzzle ID matches submission ID to prevent validating against wrong puzzle
		if (!puzzleData?.id || puzzleData.id !== body.id) {
			return c.json(
				{ error: "Puzzle not found or puzzle ID mismatch" },
				HTTP_BAD_REQUEST,
			);
		}

		const fixed = JSON.parse(puzzleData.fixed || "[]");
		const result = validateGrid(body.grid, fixed);

		if (!result.ok) {
			return c.json({ ok: false, errors: result.errors }, HTTP_OK);
		}

		// Store submission record for this post
		const key = `submission:${postId}:${body.id}`;
		const exists = await redis.get(key);
		if (!exists) {
			await redis.set(key, "1");
		}

		const currentUser = await reddit.getCurrentUser().catch(() => {});
		const username =
			currentUser?.username ||
			(await reddit.getCurrentUsername().catch(() => {})) ||
			"Unknown player";
		const avatarUrl = username
			? await reddit.getSnoovatarUrl(username).catch(() => {})
			: undefined;

		const leaderboardSetKey = leaderboardKey(body.id);
		const leaderboardDetailsKey = leaderboardMetaKey(body.id);
		const existingScore = await redis.zScore(leaderboardSetKey, userId);

		if (existingScore === undefined || solveTimeSeconds < existingScore) {
			await redis.zAdd(leaderboardSetKey, {
				score: solveTimeSeconds,
				member: userId,
			});
		}

		await redis.hSet(leaderboardDetailsKey, {
			[userId]: JSON.stringify({
				username,
				avatarUrl: avatarUrl ?? null,
			} satisfies StoredLeaderboardMeta),
		});

		// Get rank and total entries for immediate response
		const [userRank, totalEntries] = await Promise.all([
			redis.zRank(leaderboardSetKey, userId),
			redis.zCard(leaderboardSetKey),
		]);

		return c.json({
			ok: true,
			rank: userRank !== undefined && userRank !== null ? userRank + 1 : null,
			totalEntries,
		});
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		return c.json(
			{ error: `Submission failed: ${errorMessage}` },
			HTTP_BAD_REQUEST,
		);
	}
});

app.get("/api/leaderboard", async (c) => {
	const queryPuzzleId = c.req.query("puzzleId") ?? "";
	if (!queryPuzzleId) {
		return c.json({ error: "puzzleId is required" }, HTTP_BAD_REQUEST);
	}

	const pageParam = Number.parseInt(c.req.query("page") ?? "0", DECIMAL_RADIX);
	const page = Number.isNaN(pageParam) || pageParam < 0 ? 0 : pageParam;
	const requestedPageSize = Number.parseInt(
		c.req.query("pageSize") ?? `${LEADERBOARD_DEFAULT_PAGE_SIZE}`,
		DECIMAL_RADIX,
	);
	const pageSize = clampPageSize(requestedPageSize);
	const offset = page * pageSize;

	const leaderboardSetKey = leaderboardKey(queryPuzzleId);
	const leaderboardDetailsKey = leaderboardMetaKey(queryPuzzleId);

	try {
		const totalEntries = await redis.zCard(leaderboardSetKey);
		if (totalEntries === 0) {
			const emptyResponse: LeaderboardResponse = {
				entries: [],
				totalEntries,
				page,
				pageSize,
				hasNextPage: false,
				hasPreviousPage: false,
				playerEntry: null,
			};
			return c.json(emptyResponse);
		}

		const rangeMembers = await redis.zRange(
			leaderboardSetKey,
			offset,
			offset + pageSize - 1,
			{ by: "rank" },
		);

		const metaValues =
			rangeMembers.length > 0
				? await redis.hMGet(
						leaderboardDetailsKey,
						rangeMembers.map((entry) => entry.member),
					)
				: [];

		const entries: LeaderboardEntry[] = rangeMembers.map((entry, index) => {
			const rawMeta = metaValues[index];
			const parsedMeta = parseLeaderboardMeta(
				rawMeta !== null ? rawMeta : undefined,
			);

			return {
				userId: entry.member,
				username: parsedMeta.username,
				avatarUrl: parsedMeta.avatarUrl,
				timeSeconds: entry.score,
				rank: offset + index + 1,
			};
		});

		const { userId } = context;
		let playerEntry: LeaderboardEntry | null = null;
		if (userId) {
			const [playerRank, playerScore, playerMetaRaw] = await Promise.all([
				redis.zRank(leaderboardSetKey, userId),
				redis.zScore(leaderboardSetKey, userId),
				redis.hGet(leaderboardDetailsKey, userId),
			]);

			if (
				playerRank !== undefined &&
				playerRank !== null &&
				playerScore !== undefined &&
				playerScore !== null
			) {
				const playerMeta = parseLeaderboardMeta(playerMetaRaw);
				playerEntry = {
					userId,
					username: playerMeta.username,
					avatarUrl: playerMeta.avatarUrl,
					timeSeconds: playerScore,
					rank: playerRank + 1,
				};
			}
		}

		const response: LeaderboardResponse = {
			entries,
			totalEntries,
			page,
			pageSize,
			hasNextPage: offset + pageSize < totalEntries,
			hasPreviousPage: page > 0,
			playerEntry,
		};

		return c.json(response);
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		return c.json(
			{ error: `Failed to load leaderboard: ${errorMessage}` },
			HTTP_BAD_REQUEST,
		);
	}
});

export default app;
