<script lang="ts">
	import confetti from "canvas-confetti";
	import {
		SOLVE_QUALITY_LABELS,
		type SolveQuality,
	} from "../../shared/growth";
	import type { Difficulty } from "../../shared/types/puzzle";
	import { coinRewardStore } from "../stores/coinReward";
	import { game, loadPuzzle } from "../stores/game";
	import { growthStore, trackGrowthEvent } from "../stores/growth";
	import { rankStore } from "../stores/rank";
	import {
		isStreakMilestone,
		postReplay,
		postStreakConfession,
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

	// ── Streak Confession state ──────────────────────────────────────────────
	let confessionPromptVisible = $state(false);
	let confessionPosted = $state(false);
	let confessionPosting = $state(false);

	const qualityLabel = $derived(
		$growthStore.solveQuality
			? SOLVE_QUALITY_LABELS[$growthStore.solveQuality as SolveQuality]
			: "Solved",
	);

	const currentStreak = $derived(
		$growthStore.dailyProgress?.streak.currentStreak ??
			$streakStore.data.currentStreak,
	);

	// Show confession prompt if this solve landed on a milestone streak
	const shouldShowConfession = $derived(
		isStreakMilestone(currentStreak) && !confessionPosted,
	);

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
			console.error("Failed to fetch day number", error);
			dayNumber = null;
		}
	};

	const joinSubreddit = async () => {
		if (isJoining) return;
		isJoining = true;
		try {
			trackGrowthEvent("join_click");
			const res = await fetch("/api/join-subreddit", { method: "POST" });
			if (res.ok) {
				setHasJoinedSubreddit(true);
				trackGrowthEvent("join_success");
				closeSuccessModal();
			} else {
				console.error("Failed to join subreddit");
			}
		} catch (error) {
			console.error("Failed to join subreddit", error);
		} finally {
			isJoining = false;
		}
	};

	// ── Post Replay (fixes the closed-loop share problem) ───────────────────
	const handlePostReplay = async () => {
		if ($shareState.isSharing || dayNumber === null) return;
		if ($game.status !== "solved") return;

		trackGrowthEvent("share_preview");

		const streakVal = currentStreak;

		const ok = await postReplay({
			grid: $game.grid,
			dayNumber,
			solveTimeSeconds: $elapsedSeconds,
			difficulty: $game.difficulty,
			solveQuality: $growthStore.solveQuality ?? undefined,
			rank: $growthStore.playerContext?.rank ?? $rankStore.rank ?? undefined,
			...(streakVal >= 2 ? { streak: streakVal } : {}),
			...($growthStore.playerContext?.fasterThanPercentile !== undefined && $growthStore.playerContext?.fasterThanPercentile !== null
				? { fasterThanPercentile: $growthStore.playerContext.fasterThanPercentile }
				: {}),
		});

		if (ok) trackGrowthEvent("share_success");
	};

	// ── Legacy score-thread share (kept for backward compat) ────────────────
	// @ts-expect-error
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const handleShareToReddit = async () => {
		if ($shareState.isSharing || dayNumber === null) return;
		trackGrowthEvent("share_preview");
		const shared = await shareToReddit({
			solveTimeSeconds: $elapsedSeconds,
			difficulty: $game.difficulty,
			dayNumber,
			solveQuality: $growthStore.solveQuality ?? undefined,
			rank: $growthStore.playerContext?.rank ?? $rankStore.rank,
		});
		if (shared) trackGrowthEvent("share_success");
	};

	// ── Streak Confession ────────────────────────────────────────────────────
	const handleConfession = async () => {
		if (confessionPosting) return;
		confessionPosting = true;
		const ok = await postStreakConfession(currentStreak);
		confessionPosting = false;
		if (ok) {
			confessionPosted = true;
			confessionPromptVisible = false;
		}
	};

	const dismissConfession = () => {
		confessionPromptVisible = false;
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
			resetAllShareState();
			confessionPosted = false;
			confessionPromptVisible = false;
			fetchJoinedStatus();
			fetchDayNumber();
		}
	});

	// Reveal confession prompt a beat after modal opens, if applicable
	$effect(() => {
		if ($showSuccessModal && shouldShowConfession) {
			const t = setTimeout(() => {
				confessionPromptVisible = true;
			}, 1200);
			return () => clearTimeout(t);
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

		<!-- Recognition -->
		<div class="rounded-xl bg-zinc-800/70 border border-zinc-700 px-3 py-2 text-center">
			<div class="text-sm font-bold text-emerald-300">{qualityLabel}</div>
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

		<!-- ── Streak Confession prompt (milestone only, opt-in) ─────────── -->
		{#if confessionPromptVisible}
			<div class="rounded-xl border border-orange-500/40 bg-orange-950/30 px-3 py-3 text-center space-y-2">
				<p class="text-sm font-semibold text-orange-300">
					🔥 Day {currentStreak}. That's a streak.
				</p>
				<p class="text-xs text-zinc-400">
					Post this moment to r/binarygrid? Other players will see it.
					No pressure — it's opt-in.
				</p>
				<div class="flex gap-2 justify-center">
					<Button
						class="text-xs px-3 py-1.5"
						onClick={handleConfession}
						disabled={confessionPosting}
					>
						{confessionPosting ? "Posting…" : "🔥 Post my streak"}
					</Button>
					<Button
						variant="secondary"
						class="text-xs px-3 py-1.5"
						onClick={dismissConfession}
					>
						Not now
					</Button>
				</div>
			</div>
		{/if}
		{#if confessionPosted}
			<div class="rounded-xl bg-zinc-800/50 border border-zinc-700 px-3 py-2 text-center">
				<p class="text-xs text-emerald-400">✓ Streak posted to r/binarygrid</p>
			</div>
		{/if}

		<!-- Action Buttons -->
		<div class="space-y-2">
			<!-- Primary: Post Your Replay (fixes closed-loop share) -->
			<Button
				class="w-full"
				onClick={handlePostReplay}
				disabled={$shareState.isSharing || $shareState.shareSuccess === true || dayNumber === null}
			>
				{#if $shareState.isSharing}
					Posting…
				{:else if $shareState.shareSuccess === true}
					✓ Replay posted!
				{:else}
					📋 Post Your Replay
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
