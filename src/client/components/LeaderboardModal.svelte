<script lang="ts">
import { game } from "../stores/game";
import {
	goToLeaderboardPage,
	leaderboard,
	loadLeaderboard,
} from "../stores/leaderboard";
import { formatElapsedTime } from "../stores/timer";
import { closeLeaderboardModal, showLeaderboardModal } from "../stores/ui";
import Button from "./Button.svelte";
import Modal from "./Modal.svelte";

let lastLoadedPuzzleId = $state<string | null>(null);

const showPlayerSummary = () => {
	const state = $leaderboard;
	if (!state.playerEntry) {
		return false;
	}
	return !state.entries.some(
		(entry) => entry.userId === state.playerEntry?.userId,
	);
};

const goToNextPage = () => {
	if (!$leaderboard.hasNextPage) {
		return;
	}
	goToLeaderboardPage($leaderboard.page + 1);
};

const goToPreviousPage = () => {
	if (!$leaderboard.hasPreviousPage) {
		return;
	}
	goToLeaderboardPage(Math.max(0, $leaderboard.page - 1));
};

const formatRankLabel = (rank: number) => `#${rank}`;

$effect(() => {
	if (!$showLeaderboardModal) {
		return;
	}
	const puzzleId = $game.puzzleId;
	if (!puzzleId) {
		return;
	}
	if ($leaderboard.status === "idle" || lastLoadedPuzzleId !== puzzleId) {
		lastLoadedPuzzleId = puzzleId;
		loadLeaderboard(puzzleId);
	}
});
</script>

<Modal
	open={$showLeaderboardModal}
	onClose={closeLeaderboardModal}
	labelledby="leaderboard-modal-title"
	describedby="leaderboard-modal-description"
>
	<section class="flex max-h-full flex-col gap-4">
		<h2 id="leaderboard-modal-title">Leaderboard</h2>

		{#if $leaderboard.status === 'loading'}
			<div
				class="flex flex-1 flex-col items-center justify-center gap-3 py-10"
				role="status"
				aria-live="polite"
			>
				<div
					class="size-4 md:size-6 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin"
					aria-hidden="true"
				></div>
				<p class="text-sm text-zinc-600 dark:text-zinc-400">
					Loading leaderboard…
				</p>
			</div>
		{:else if $leaderboard.status === 'error'}
			<p class="rounded-lg bg-error/10 p-4 text-sm text-error">
				{$leaderboard.error ?? 'Unable to load leaderboard. Please try again.'}
			</p>
		{:else}
			{@const state = $leaderboard}
			<div
				class="flex-1 overflow-y-auto space-y-3 pr-1 relative"
				style="background-image: repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(161, 161, 170, 0.03) 1px, rgba(161, 161, 170, 0.03) 2px);"
			>
				{#if showPlayerSummary()}
					<div
						class="border border-zinc-400/50 bg-zinc-200/30 dark:bg-zinc-800/30 p-4 text-sm text-zinc-800 dark:text-zinc-300 rounded-lg"
					>
						<h3 class="text-zinc-800 dark:text-zinc-300">Your ranking</h3>
						<div class="flex items-center justify-center gap-3">
							<span class="text-sm font-semibold">
								{formatRankLabel(state.playerEntry?.rank ?? 0)}
							</span>
							<p class="text-sm">
								{state.playerEntry?.username ?? 'You'}
							</p>
							<p class="text-xs">
								{formatElapsedTime(
									Math.round(state.playerEntry?.timeSeconds ?? 0),
								)}
							</p>
						</div>
					</div>
				{/if}
				{#if state.entries.length === 0}
					<p class="text-sm text-zinc-600 dark:text-zinc-400">
						No leaderboard entries yet.
					</p>
				{:else}
					<ol class="space-y-0.5">
						{#each state.entries as entry (entry.userId)}
							<li
								class={`flex items-center gap-3 rounded-lg border border-transparent ${
									entry.userId === state.playerEntry?.userId
										? 'border-zinc-400/60 bg-zinc-200/30 dark:bg-zinc-800/30'
										: ''
								}`}
							>
								<p class="text-xs truncate">
									{formatRankLabel(entry.rank)}
								</p>
								<p class="flex-1 text-xs">{entry.username}</p>
								<p class="text-sm">
									{formatElapsedTime(Math.round(entry.timeSeconds))}
								</p>
							</li>
						{/each}
					</ol>
				{/if}
			</div>

			{#if $leaderboard.entries.length > 0}
				<nav class="flex items-center justify-between text-xs">
					<Button
						variant="ghost"
						size="sm"
						onClick={goToPreviousPage}
						disabled={!$leaderboard.hasPreviousPage}
					>
						Previous
					</Button>
					<p class="text-sm mb-0">[Page {$leaderboard.page + 1}]</p>
					<Button
						variant="ghost"
						size="sm"
						onClick={goToNextPage}
						disabled={!$leaderboard.hasNextPage}
					>
						Next
					</Button>
				</nav>
			{/if}
		{/if}
	</section>
</Modal>
