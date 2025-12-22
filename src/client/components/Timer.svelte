<script lang="ts">
	import { game } from '../stores/game'
	import { elapsedSeconds, formatElapsedTime } from '../stores/timer'
</script>

<div class="text-md font-semibold text-zinc-800 dark:text-zinc-300">
	{#if $game.status === 'idle'}
		--:--
	{:else}
		{formatElapsedTime($elapsedSeconds)}
	{/if}
</div>
