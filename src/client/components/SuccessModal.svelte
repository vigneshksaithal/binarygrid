<script lang="ts">
	import confetti from "canvas-confetti";
	import {
		SOLVE_QUALITY_DEFINITIONS,
		SOLVE_QUALITY_LABELS,
		type SolveQuality,
	} from "../../shared/growth";
	import { coinRewardStore } from "../stores/coinReward";
	import { growthStore } from "../stores/growth";
	import { rankStore } from "../stores/rank";
	import { streakStore } from "../stores/streak";
	import {
		elapsedSeconds,
		formatElapsedTime,
	} from "../stores/timer";
	import {
		closeSuccessModal,
		showSuccessModal,
	} from "../stores/ui";
	import Modal from "./Modal.svelte";
	import SubmitStatus from "./SubmitStatus.svelte";
	import SuccessActions from "./SuccessActions.svelte"

	let dayNumber = $state<number | null>(null);

	const qualityLabel = $derived(
		$growthStore.solveQuality
			? SOLVE_QUALITY_LABELS[$growthStore.solveQuality as SolveQuality]
			: "Solved",
	);

	const currentStreak = $derived(
		$growthStore.dailyProgress?.streak.currentStreak ??
			$streakStore.data.currentStreak,
	);

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
			console.error("Failed to fetch day number", error);
			dayNumber = null;
		}
	};

	const showConfetti = () => {
		confetti({
			particleCount: 100,
			spread: 70,
			origin: { y: 0.6 },
		});
	};

	$effect(() => {
		if ($showSuccessModal) {
			showConfetti();
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
				<div class="text-xl font-bold text-orange-400">🔥{currentStreak}</div>
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
		<!-- Save status; the login line for logged-out solvers -->
		<SubmitStatus />

		<!-- Recognition -->
		<div class="rounded-xl bg-zinc-800/70 border border-zinc-700 px-3 py-2 text-center">
			<div class="text-sm font-bold text-emerald-300">{qualityLabel}</div>
			{#if $growthStore.solveQuality}
				<p class="text-xs text-zinc-400 mt-1 mb-0">
					{SOLVE_QUALITY_DEFINITIONS[$growthStore.solveQuality]}
				</p>
			{/if}
			{#if $growthStore.playerContext}
				<p class="text-xs text-zinc-400 mt-1 mb-0">
					Faster than {$growthStore.playerContext.fasterThanPercentile}% today
					{#if $growthStore.playerContext.nextRankSeconds !== null}
						· {$growthStore.playerContext.nextRankSeconds}s from next rank
					{/if}
				</p>
			{/if}
			{#if $growthStore.dailyProgress}
				<p class="text-xs text-zinc-400 mt-1 mb-0">
					{$growthStore.dailyProgress.trio.completedCount}/3 difficulties today
					{#if $growthStore.dailyProgress.trio.perfectDay}
						· Perfect Day
					{:else if $growthStore.dailyProgress.trio.trioComplete}
						· Trio Complete
					{/if}
					{#if $growthStore.dailyProgress.streak.freezes > 0}
						· {$growthStore.dailyProgress.streak.freezes} freeze{$growthStore.dailyProgress.streak.freezes === 1 ? "" : "s"}
					{/if}
				</p>
			{/if}
		</div>

		<!-- Action Buttons -->
		<SuccessActions {dayNumber} streak={currentStreak} />
	</div>
</Modal>
