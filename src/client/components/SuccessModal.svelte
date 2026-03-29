<script lang="ts">
	import confetti from "canvas-confetti";
	import type { Difficulty } from "../../shared/types/puzzle";
	import { coinRewardStore } from "../stores/coinReward";
	import { game, loadPuzzle } from "../stores/game";
	import { rankStore } from "../stores/rank";
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
	<div id="success-modal-body" class="space-y-4">
		<!-- Header -->
		<div class="text-center">
			<h2
				id="success-modal-title"
				class="text-2xl font-bold text-green-400"
			>
				🎉 Solved!
			</h2>
			{#if dayNumber !== null}
				<p class="text-xs text-zinc-500 mt-0.5">Binary Grid #{dayNumber}</p>
			{/if}
		</div>

		<!-- Stats row: Time · Rank · Streak · Coins -->
		<div class="grid grid-cols-4 gap-2 text-center">
			<div>
				<div class="text-xl font-bold text-green-400">{formatElapsedTime($elapsedSeconds)}</div>
				<div class="text-xs text-zinc-500">Time</div>
			</div>
			{#if $rankStore.rank !== null && $rankStore.totalEntries !== null}
				<div>
					<div class="text-xl font-bold text-green-400">#{$rankStore.rank}</div>
					<div class="text-xs text-zinc-500">Rank</div>
				</div>
			{:else}
				<div></div>
			{/if}
			<div>
				<div class="text-xl font-bold text-orange-400">🔥{$streakStore.data.currentStreak}</div>
				<div class="text-xs text-zinc-500">Streak</div>
			</div>
			{#if $coinRewardStore !== null}
				<div>
					<div class="text-xl font-bold text-yellow-400">+{$coinRewardStore.total}</div>
					<div class="text-xs text-zinc-500">🪙 Coins</div>
				</div>
			{:else}
				<div></div>
			{/if}
		</div>

		<!-- Action Buttons -->
		<div class="space-y-2">
			<Button
				class="w-full"
				onClick={handleShareToReddit}
				disabled={$shareState.isSharing || $shareState.shareSuccess === true || dayNumber === null}
			>
				{#if $shareState.isSharing}
					Sharing…
				{:else if $shareState.shareSuccess === true}
					✓ Shared!
				{:else}
					📢 Share Score
				{/if}
			</Button>

			<Button
				class="w-full"
				variant="secondary"
				onClick={playAnotherDifficulty}
			>
				{#if $game.difficulty === "easy"}
					Try Medium →
				{:else if $game.difficulty === "medium"}
					Try Hard →
				{:else}
					Try Easy →
				{/if}
			</Button>

			{#if !$hasJoinedSubreddit}
				<Button class="w-full" variant="secondary" onClick={joinSubreddit} disabled={isJoining}>
					{isJoining ? "Joining…" : "🎮 Join r/binarygrid"}
				</Button>
			{/if}
		</div>
	</div>
</Modal>
