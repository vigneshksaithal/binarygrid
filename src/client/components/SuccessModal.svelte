<script lang="ts">
	import confetti from "canvas-confetti";
	import type { Difficulty } from "../../shared/types/puzzle";
	import { game, loadPuzzle } from "../stores/game";
	import { calculatePercentile, rankStore } from "../stores/rank";
	import {
		resetAllShareState,
		shareState,
		shareToReddit,
	} from "../stores/share";
	import { streakStore } from "../stores/streak";
	import {
		elapsedSeconds,
		formatElapsedTime,
		startTimer,
	} from "../stores/timer";
	import {
		closeSuccessModal,
		hasJoinedSubreddit,
		setHasJoinedSubreddit,
		showSuccessModal,
	} from "../stores/ui";
	import Button from "./Button.svelte";
	import Modal from "./Modal.svelte";

	let isJoining = $state(false);
	let dayNumber = $state<number | null>(null);

	const getNextDifficulty = (current: Difficulty): Difficulty => {
		if (current === "easy") return "medium";
		if (current === "medium") return "hard";
		return "easy";
	};

	const playAnotherDifficulty = async () => {
		const currentDifficulty = $game.difficulty;
		const nextDifficulty = getNextDifficulty(currentDifficulty);
		await loadPuzzle(nextDifficulty);
		startTimer();
	};

	const fetchJoinedStatus = async () => {
		try {
			const res = await fetch("/api/check-joined-status");
			if (res.ok) {
				const data = await res.json();
				setHasJoinedSubreddit(data.hasJoined);
			}
		} catch (error) {
			// biome-ignore lint/suspicious/noConsole: we want to log the error
			console.error("Failed to check joined status", error);
		}
	};

	const fetchDayNumber = async () => {
		try {
			const res = await fetch("/api/puzzle-number");
			if (res.ok) {
				const data = await res.json();
				dayNumber = data.dayNumber;
			} else {
				dayNumber = null;
			}
		} catch (error) {
			// biome-ignore lint/suspicious/noConsole: we want to log the error
			console.error("Failed to fetch day number", error);
			dayNumber = null;
		}
	};

	const joinSubreddit = async () => {
		if (isJoining) {
			return;
		}
		isJoining = true;

		try {
			const res = await fetch("/api/join-subreddit", {
				method: "POST",
			});
			if (res.ok) {
				setHasJoinedSubreddit(true);
				closeSuccessModal();
			} else {
				// biome-ignore lint/suspicious/noConsole: we want to log the error
				console.error("Failed to join subreddit");
			}
		} catch (error) {
			// biome-ignore lint/suspicious/noConsole: we want to log the error
			console.error("Failed to join subreddit", error);
		} finally {
			isJoining = false;
		}
	};

	const handleShareToReddit = async () => {
		if ($shareState.isSharing || dayNumber === null) {
			return;
		}

		await shareToReddit({
			solveTimeSeconds: $elapsedSeconds,
			difficulty: $game.difficulty,
			dayNumber,
		});
	};

	const showConfetti = () => {
		const CONFETTI_PARTICLE_COUNT = 100;
		const CONFETTI_SPREAD = 70;
		const CONFETTI_ORIGIN_Y = 0.6; // Vertical origin to start confetti lower on the screen

		confetti({
			particleCount: CONFETTI_PARTICLE_COUNT,
			spread: CONFETTI_SPREAD,
			origin: { y: CONFETTI_ORIGIN_Y },
		});
	};

	$effect(() => {
		if ($showSuccessModal) {
			showConfetti();
			resetAllShareState();
			fetchJoinedStatus();
			fetchDayNumber();
		}
	});
</script>

<Modal
	open={$showSuccessModal}
	onClose={closeSuccessModal}
	labelledby="success-modal-title"
	describedby="success-modal-body"
>
	<div id="success-modal-body" class="space-y-6">
		<!-- Header -->
		<div class="text-center">
			<h2
				id="success-modal-title"
				class="text-3xl font-bold text-green-600 dark:text-green-400 mb-2"
			>
				🎉 Puzzle Solved!
			</h2>
			{#if dayNumber !== null}
				<p class="text-sm text-zinc-600 dark:text-zinc-400">
					Binary Grid #{dayNumber}
				</p>
			{/if}
		</div>

		<!-- Stats Card -->
		<div
			class="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-xl p-6 border-2 border-green-200 dark:border-green-800"
		>
			<div class="grid grid-cols-3 gap-4">
				<!-- Time -->
				<div class="text-center">
					<div
						class="text-3xl font-bold text-green-600 dark:text-green-400"
					>
						{formatElapsedTime($elapsedSeconds)}
					</div>
					<div class="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
						Your Time
					</div>
				</div>

				<!-- Rank -->
				{#if $rankStore.rank !== null && $rankStore.totalEntries !== null}
					<div class="text-center">
						<div
							class="text-3xl font-bold text-green-600 dark:text-green-400"
						>
							#{$rankStore.rank}
						</div>
						<div
							class="text-xs text-zinc-600 dark:text-zinc-400 mt-1"
						>
							Top {calculatePercentile(
								$rankStore.rank,
								$rankStore.totalEntries,
							)}%
						</div>
					</div>
				{/if}

				<!-- Streak -->
				<div class="text-center">
					<div
						class="text-3xl font-bold text-orange-600 dark:text-orange-400"
					>
						🔥 {$streakStore.data.currentStreak}
					</div>
					<div class="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
						Day Streak
					</div>
				</div>
			</div>

			<!-- Competitive Message -->
			{#if $rankStore.rank !== null && $rankStore.totalEntries !== null}
				<div
					class="mt-4 pt-4 border-t border-green-200 dark:border-green-800"
				>
					{#if $rankStore.rank === 1}
						<p
							class="text-center text-sm font-semibold text-green-700 dark:text-green-300"
						>
							🏆 You're #1! Can you defend your position?
						</p>
					{:else if calculatePercentile($rankStore.rank, $rankStore.totalEntries) <= 10}
						<p
							class="text-center text-sm font-semibold text-green-700 dark:text-green-300"
						>
							🔥 Top 10%! You're crushing it!
						</p>
					{:else if calculatePercentile($rankStore.rank, $rankStore.totalEntries) <= 25}
						<p
							class="text-center text-sm font-semibold text-green-700 dark:text-green-300"
						>
							💪 Top 25%! Keep climbing!
						</p>
					{:else}
						<p
							class="text-center text-sm text-zinc-600 dark:text-zinc-400"
						>
							Beat {$rankStore.totalEntries - $rankStore.rank} players!
							Can you go faster?
						</p>
					{/if}
				</div>
			{/if}

			<!-- Streak Motivational Message -->
			{#if $streakStore.data.currentStreak > 0}
				<div
					class="mt-4 pt-4 border-t border-green-200 dark:border-green-800"
				>
					<p
						class="text-center text-sm font-semibold text-orange-700 dark:text-orange-300"
					>
						Come back tomorrow to keep your 🔥 {$streakStore.data
							.currentStreak + 1} day streak!
					</p>
				</div>
			{:else}
				<div
					class="mt-4 pt-4 border-t border-green-200 dark:border-green-800"
				>
					<p
						class="text-center text-sm text-zinc-600 dark:text-zinc-400"
					>
						Start your streak today! Come back tomorrow to keep it
						going! 🔥
					</p>
				</div>
			{/if}
		</div>

		<!-- Action Buttons -->
		<div class="space-y-3">
			<!-- Share to Reddit -->
			{#if $shareState.shareSuccess === true}
				<div
					class="text-center py-2 px-4 bg-green-100 dark:bg-green-900 rounded-lg"
				>
					<p
						class="text-green-700 dark:text-green-300 font-semibold text-sm"
					>
						✓ Shared to Reddit!
					</p>
				</div>
			{:else if $shareState.shareSuccess === false}
				<div
					class="text-center py-2 px-4 bg-red-100 dark:bg-red-900 rounded-lg"
				>
					<p
						class="text-red-700 dark:text-red-300 font-semibold text-sm"
					>
						{$shareState.shareError ||
							"Failed to share. Please try again."}
					</p>
				</div>
			{/if}

			<Button
				class="w-full"
				onClick={handleShareToReddit}
				disabled={$shareState.isSharing ||
					$shareState.shareSuccess === true ||
					dayNumber === null}
			>
				{#if $shareState.isSharing}
					Sharing…
				{:else if $shareState.shareSuccess === true}
					Shared to Reddit
				{:else}
					📢 Share Your Score
				{/if}
			</Button>

			<!-- Try Another Difficulty -->
			<Button
				class="w-full"
				variant="secondary"
				onClick={playAnotherDifficulty}
			>
				{#if $game.difficulty === "easy"}
					🔥 Try Medium Challenge
				{:else if $game.difficulty === "medium"}
					💪 Try Hard Challenge
				{:else}
					🎯 Try Easy Mode
				{/if}
			</Button>
		</div>

		<!-- Join Subreddit CTA -->
		{#if !$hasJoinedSubreddit}
			<div class="pt-4 border-t border-zinc-200 dark:border-zinc-700">
				<div class="text-center mb-3">
					<p class="text-sm text-zinc-600 dark:text-zinc-400">
						Join r/binarygrid for daily puzzles & compete with
						others!
					</p>
				</div>
				<Button
					class="w-full"
					onClick={joinSubreddit}
					disabled={isJoining}
				>
					{#if isJoining}
						Joining…
					{:else}
						🎮 Join Community
					{/if}
				</Button>
			</div>
		{/if}
	</div>
</Modal>
