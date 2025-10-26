<script lang="ts">
import { game } from '../stores/game'
import { elapsedSeconds, formatElapsedTime } from '../stores/timer'
</script>

<div class="text-primary-green font-semibold text-center">
	{#if $game.status === 'idle'}
		Time: --:--
	{:else}
		Time: {formatElapsedTime($elapsedSeconds)}
	{/if}
</div>
