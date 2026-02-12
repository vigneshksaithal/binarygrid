<script lang="ts">
	import Medal from "@lucide/svelte/icons/medal";
	import type { LeaderboardEntry } from "../../shared/types/leaderboard";
	import { formatElapsedTime } from "../stores/timer";

	type Props = {
		entries: LeaderboardEntry[];
		isLoading: boolean;
	};

	let { entries, isLoading }: Props = $props();

	const getRankColor = (rank: number): string => {
		switch (rank) {
			case 1:
				return "text-amber-500";
			case 2:
				return "text-zinc-400";
			case 3:
				return "text-amber-700";
			default:
				return "text-zinc-500";
		}
	};
</script>

<div class="w-full max-w-sm mt-4">
	<h3
		class="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2 text-center"
	>
		Top Players
	</h3>

	{#if isLoading}
		<div
			class="rounded-lg bg-zinc-100/50 dark:bg-zinc-800/50 overflow-hidden"
		>
			{#each [1, 2, 3] as i, index (i)}
				<div class="flex items-center gap-3 p-2.5">
					<div
						class="size-6 rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse"
					></div>
					<div
						class="size-7 rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse"
					></div>
					<div
						class="flex-1 h-3.5 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse"
					></div>
					<div
						class="w-10 h-3.5 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse"
					></div>
				</div>
			{/each}
		</div>
	{:else if entries.length === 0}
		<div
			class="text-center py-5 px-4 rounded-lg bg-zinc-100/50 dark:bg-zinc-800/50 border border-dashed border-zinc-300 dark:border-zinc-700"
		>
			<p class="text-sm text-zinc-500 dark:text-zinc-400">
				Be the first to play!
			</p>
		</div>
	{:else}
		<div
			class="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 overflow-hidden"
		>
			{#each entries.slice(0, 3) as entry, index (entry.userId)}
				<div class="flex items-center gap-2.5 p-2.5">
					<div class="shrink-0">
						<Medal class="size-5 {getRankColor(entry.rank)}" />
					</div>

					{#if entry.avatarUrl}
						<img
							src={entry.avatarUrl}
							alt=""
							class="size-7 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
						/>
					{:else}
						<div
							class="size-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 shrink-0"
						>
							{entry.username.charAt(0).toUpperCase()}
						</div>
					{/if}

					<p
						class="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate"
					>
						{entry.username}
					</p>

					<p
						class="text-sm font-mono text-zinc-500 dark:text-zinc-400 shrink-0"
					>
						{formatElapsedTime(Math.round(entry.timeSeconds))}
					</p>
				</div>
			{/each}
		</div>
	{/if}
</div>
