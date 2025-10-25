<script lang="ts">
import { game } from '../stores/game'
import { elapsedSeconds, formatElapsedTime } from '../stores/timer'
</script>

<p class="text-primary-green font-semibold text-center">
	{#if $game.status === 'idle'}
		Time: --:--
	{:else}
		Time: {formatElapsedTime($elapsedSeconds)}
	{/if}
</p>
