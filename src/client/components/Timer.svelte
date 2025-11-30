<script lang="ts">
	import { game } from '../stores/game'
	import { elapsedSeconds, formatElapsedTime } from '../stores/timer'
</script>

<div
	class="text-xl font-mono font-semibold text-green-600 dark:text-green-400 text-left flex items-center gap-2"
>
	{#if $game.status === 'idle'}
		--:--
	{:else}
		~{formatElapsedTime($elapsedSeconds)}
	{/if}
</div>
