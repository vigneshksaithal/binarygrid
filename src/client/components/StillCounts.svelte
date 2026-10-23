<script lang="ts">
	import { formatStillCounts } from '../../shared/streak-copy'
	import { openPost } from '../services/navigate'
	import { streakStore } from '../stores/streak'
	import Button from './Button.svelte'

	// Only the puzzle rule sends a pointer, so the calendar rule shows nothing here.
	const stillCounts = $derived($streakStore.data.stillCounts ?? null)
	const text = $derived(
		stillCounts ? formatStillCounts(stillCounts.number, Date.parse(stillCounts.closesAt), Date.now()) : '',
	)
</script>

{#if stillCounts}
	<div class="mt-2 flex items-center justify-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
		<span>{text}</span>
		<span aria-hidden="true">·</span>
		<Button
			size="sm"
			variant="secondary"
			onClick={() => openPost(stillCounts.postId)}
			ariaLabel={`Play #${stillCounts.number}`}
		>
			Play
		</Button>
	</div>
{/if}
