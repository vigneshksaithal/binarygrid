<script lang="ts">
	import { game } from '../stores/game'
	import { elapsedSeconds, formatElapsedTime } from '../stores/timer'
</script>

<div class="text-md font-mono font-semibold text-green-800 dark:text-green-400">
	{#if $game.status === 'idle'}
		--:--
	{:else}
		~{formatElapsedTime($elapsedSeconds)}
	{/if}
</div>
