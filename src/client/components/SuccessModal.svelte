<script lang="ts">
	import { context } from "@devvit/web/client"
	import confetti from "canvas-confetti";
	import {
		SOLVE_QUALITY_DEFINITIONS,
		SOLVE_QUALITY_LABELS,
		type SolveQuality,
	} from "../../shared/growth";
	import {
		DEFINITION_RESERVES,
		FASTER_LINE_RESERVES,
		formatFasterLine,
		formatProgressLine,
		FREEZE_MESSAGE_RESERVES,
		PROGRESS_LINE_RESERVES,
	} from "../services/result-lines"
	import { growthStore } from "../stores/growth";
	import { loadPuzzleNumber, puzzleNumber } from "../stores/puzzle-number"
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
	import ReservedText from "./ReservedText.svelte"
	import SubmitStatus from "./SubmitStatus.svelte";
	import SuccessActions from "./SuccessActions.svelte"

	const NO_RESERVES: readonly string[] = []

	// A logged-in solve's saved reply fills the recognition lines after the screen
	// opens, so they hold their room from the start and the buttons never move. A
	// logged-out solve gets no reply, so its lines hold none. The Devvit context
	// is missing outside Reddit (local `vite dev`).
	const awaitsSavedResult = Boolean(context?.userId)
	const reservesFor = (reserves: readonly string[]) =>
		awaitsSavedResult ? reserves : NO_RESERVES

	const qualityLabel = $derived(
		$growthStore.solveQuality
			? SOLVE_QUALITY_LABELS[$growthStore.solveQuality as SolveQuality]
			: "Solved",
	);

	const definitionLine = $derived.by(() => {
		const quality = $growthStore.solveQuality
		return quality ? SOLVE_QUALITY_DEFINITIONS[quality] : null
	})
	const fasterLine = $derived(formatFasterLine($growthStore.playerContext))
	const progressLine = $derived(formatProgressLine($growthStore.dailyProgress))

	const currentStreak = $derived(
		$growthStore.dailyProgress?.streak.currentStreak ??
			$streakStore.data.currentStreak,
	);

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
			// Usually known since the app opened; asks again if that request failed
			loadPuzzleNumber()
		}
	});
</script>

<Modal
	open={$showSuccessModal}
	onClose={closeSuccessModal}
	labelledby="success-modal-title"
	describedby="success-modal-body"
>
	<!-- Tighter gaps than before win back part of the room the reserved lines hold -->
	<div id="success-modal-body" class="space-y-3">
		<!-- Header -->
		<div class="text-center">
			<h2
				id="success-modal-title"
				class="text-2xl font-bold text-green-400 mb-0"
			>
				🎉 Solved!
			</h2>
			<!-- A fixed height, since #N can arrive after the screen opens -->
			<p class="h-4 text-xs text-zinc-500 mt-0.5">
				{#if $puzzleNumber !== null}Binary Grid #{$puzzleNumber}{/if}
			</p>
		</div>

		<!-- Stats row: Time · Rank · Streak -->
		<div class="grid grid-cols-3 gap-2 text-center">
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
		</div>
		<!-- Save status; the login line for logged-out solvers -->
		<SubmitStatus />

		<!-- Recognition: the label at once, then the lines the saved solve fills in -->
		<div class="rounded-xl bg-zinc-800/70 border border-zinc-700 px-3 py-2 text-center">
			<div class="text-sm font-bold text-emerald-300">{qualityLabel}</div>
			<ReservedText
				class="text-xs text-zinc-400 mt-1 mb-0"
				text={definitionLine}
				reserves={reservesFor(DEFINITION_RESERVES)}
			/>
			<ReservedText
				class="text-xs text-zinc-400 mt-1 mb-0"
				text={fasterLine}
				reserves={reservesFor(FASTER_LINE_RESERVES)}
			/>
			<ReservedText
				class="text-xs text-zinc-400 mt-1 mb-0"
				text={progressLine}
				reserves={reservesFor(PROGRESS_LINE_RESERVES)}
			/>
			<!-- Task 6's freeze message: it fills this line's text -->
			<ReservedText
				class="text-xs text-zinc-400 mt-1 mb-0"
				text={null}
				reserves={reservesFor(FREEZE_MESSAGE_RESERVES)}
			/>
		</div>

		<!-- Action Buttons -->
		<SuccessActions dayNumber={$puzzleNumber} streak={currentStreak} />
	</div>
</Modal>
