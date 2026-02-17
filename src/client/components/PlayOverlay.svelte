<script lang="ts">
	import ZapIcon from "@lucide/svelte/icons/zap";
	import { cubicOut } from "svelte/easing";
	import { fade, fly } from "svelte/transition";
	import type { Difficulty } from "../../shared/types/puzzle";
	import type { LeaderboardEntry } from "../../shared/types/leaderboard";
	import { loadPuzzle } from "../stores/game";
	import { fetchStreak, streakStore } from "../stores/streak";
	import { startTimer } from "../stores/timer";
	import { closePlayOverlay, showPlayOverlay } from "../stores/ui";
	import Circle from "./Circle.svelte";
	import Line from "./Line.svelte";
	import LeaderboardPreview from "./LeaderboardPreview.svelte";

	let playCount = $state<number | null>(null);
	let selectedDifficulty = $state<Difficulty>("easy");
	let leaderboardEntries = $state<LeaderboardEntry[]>([]);
	let isLoadingLeaderboard = $state(false);

	const binaryGrid = [
		[1, 0],
		[0, 1],
	];

	const fixedCells = [
		[true, false],
		[false, true],
	];

	const startGame = async () => {
		closePlayOverlay();
		await loadPuzzle(selectedDifficulty);
		startTimer();
	};

	const fetchPlayCount = async () => {
		try {
			const res = await fetch("/api/play-count");
			const data = res.ok ? await res.json() : { count: 0 };
			playCount = data.count ?? 0;
		} catch {
			playCount = 0;
		}
	};

	const formatPlayCount = (count: number): string =>
		new Intl.NumberFormat("en", { notation: "compact" }).format(count);

	const fetchTopLeaderboard = async () => {
		isLoadingLeaderboard = true;
		try {
			const puzzleRes = await fetch("/api/puzzle?difficulty=easy");
			if (!puzzleRes.ok) {
				leaderboardEntries = [];
				return;
			}
			const puzzleData = await puzzleRes.json();
			const puzzleId = puzzleData.puzzle?.id;
			if (!puzzleId) {
				leaderboardEntries = [];
				return;
			}

			const query = new URLSearchParams({
				puzzleId,
				page: "0",
				pageSize: "3",
			});
			const res = await fetch(`/api/leaderboard?${query.toString()}`);
			if (res.ok) {
				const data = await res.json();
				leaderboardEntries = data.entries ?? [];
			}
		} catch {
			leaderboardEntries = [];
		} finally {
			isLoadingLeaderboard = false;
		}
	};

	$effect.pre(() => {
		if ($showPlayOverlay) {
			fetchPlayCount();
			fetchTopLeaderboard();
			fetchStreak();
		}
	});

	let currentStreak = $state(0)
	let todayCompleted = $state(false)
	let streakStatus = $state('idle')

	$effect(() => {
		const unsub = streakStore.subscribe(s => {
			streakStatus = s.status
			currentStreak = s.data.currentStreak
			todayCompleted = s.data.todayCompleted
		})
		return unsub
	})
</script>

{#if $showPlayOverlay}
	<div
		class="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 bg-linear-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800"
	>
		{#if playCount !== null && playCount > 0}
			<div
				class="absolute top-0 left-0 overflow-hidden w-48 h-52 pointer-events-none"
				in:fly={{ x: -60, y: -60, duration: 500, easing: cubicOut }}
			>
				<div
					class="absolute top-8 -left-16 w-60 -rotate-45 bg-linear-to-r from-indigo-500 to-purple-600 text-white text-lg font-bold py-2 text-center shadow-lg animate-ribbon-shimmer"
				>
					{formatPlayCount(playCount)} plays
				</div>
			</div>
		{/if}

		<div
			class="grid grid-cols-2 border-2 border-zinc-300 dark:border-zinc-600 rounded-xl overflow-hidden mb-4 mx-auto"
			in:fade={{ duration: 600, delay: 200 }}
		>
			{#each binaryGrid as row, rowIndex (rowIndex)}
				{#each row as cell, cellIndex (`${rowIndex}-${cellIndex}`)}
					<div
						class="w-7 h-7 flex items-center justify-center text-zinc-800 dark:text-zinc-200 {fixedCells[
							rowIndex
						]?.[cellIndex]
							? 'bg-zinc-200 dark:bg-zinc-700'
							: ''} {cellIndex < 1
							? 'border-r-2 border-r-zinc-300 dark:border-r-zinc-600'
							: ''} {rowIndex < 1
							? 'border-b-2 border-b-zinc-300 dark:border-b-zinc-600'
							: ''}"
					>
						<div>
							{#if cell === 1}
								<Line class="size-3" />
							{:else}
								<Circle class="size-3" />
							{/if}
						</div>
					</div>
				{/each}
			{/each}
		</div>

		<h1
			class="max-w-xs mx-auto text-5xl md:text-6xl text-center font-black bg-linear-to-r from-zinc-600 to-zinc-800 dark:from-zinc-300 dark:to-zinc-100 bg-clip-text text-transparent mb-6"
		>
			Binary Grid
		</h1>

		<div class="w-full max-w-sm">
			<button
				class="w-full relative overflow-hidden group py-6 px-8 rounded-2xl font-black text-2xl uppercase tracking-wider transition-all transform hover:scale-105 active:scale-95 shadow-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-green-500 bg-linear-to-r from-green-500 to-emerald-600 animate-bounce duration-500"
				onclick={startGame}
				aria-label="Start game"
			>
				<div
					class="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"
				></div>

				<span
					class="relative text-white drop-shadow-lg flex items-center justify-center gap-3"
				>
					<ZapIcon class="size-8" />
					PLAY
				</span>
			</button>
		</div>

		{#if streakStatus === 'ready'}
			<div class="mt-4 text-center">
				{#if currentStreak > 0}
					<p class="text-sm font-semibold text-orange-600 dark:text-orange-400">
						🔥 {currentStreak} day streak — keep it alive!
					</p>
				{:else if todayCompleted}
					<p class="text-sm font-semibold text-green-600 dark:text-green-400">
						✅ Today's streak secured! Play for fun or try harder difficulty
					</p>
				{:else}
					<p class="text-sm text-zinc-600 dark:text-zinc-400">
						Start your streak today! 🔥
					</p>
				{/if}
			</div>
		{/if}

		<LeaderboardPreview
			entries={leaderboardEntries}
			isLoading={isLoadingLeaderboard}
		/>
	</div>

	<style>
		@keyframes ribbon-shimmer {
			0%,
			100% {
				opacity: 0.9;
			}
			50% {
				opacity: 1;
				box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
			}
		}

		.animate-ribbon-shimmer {
			animation: ribbon-shimmer 2s ease-in-out infinite;
		}
	</style>
{/if}
