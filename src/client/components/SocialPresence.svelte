<script lang="ts">
	import Users from "@lucide/svelte/icons/users";
	import { onMount } from "svelte";
	import {
		sendHeartbeat,
		socialStore,
		startSocialPolling,
		stopSocialPolling,
	} from "../stores/social";
	import RecentAvatars from "./RecentAvatars.svelte";
	import SolveCounter from "./SolveCounter.svelte";

	type Props = {
		postId: string;
	};

	const { postId }: Props = $props();

	const data = $derived($socialStore);

	onMount(() => {
		startSocialPolling(postId);
		sendHeartbeat(postId);

		return () => {
			stopSocialPolling();
		};
	});

	const activePlayers = $derived(data?.activePlayers ?? 0);
	const solvedToday = $derived(data?.solvedToday ?? 0);
	const recentSolvers = $derived(data?.recentSolvers ?? []);
	const activeLabel = $derived(
		activePlayers === 1 ? "solving now" : "solving now",
	);
</script>

<div class="flex flex-col gap-2" aria-label="Social presence">
	{#if data === null}
		<!-- Placeholder skeleton while data loads -->
		<div class="flex items-center gap-2">
			<div
				class="size-4 rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse shrink-0"
			></div>
			<div
				class="h-3.5 w-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse"
			></div>
		</div>
		<div class="flex items-center gap-2">
			<div
				class="size-4 rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse shrink-0"
			></div>
			<div
				class="h-3.5 w-32 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse"
			></div>
		</div>
	{:else}
		<!-- Active player count -->
		<div
			class="flex items-center gap-1.5"
			title="Players currently solving"
		>
			<Users class="size-4 text-emerald-500 shrink-0" />
			<span class="text-xs font-medium text-zinc-700 dark:text-zinc-300">
				<span class="font-semibold text-zinc-900 dark:text-zinc-100"
					>{activePlayers}</span
				>
				{activeLabel}
			</span>
		</div>

		<!-- Today's solve count -->
		<SolveCounter count={solvedToday} />

		<!-- Recent solver avatars -->
		{#if recentSolvers.length > 0}
			<RecentAvatars solvers={recentSolvers} />
		{/if}
	{/if}
</div>
