<script lang="ts">
	import TimerIcon from '@lucide/svelte/icons/timer'
	import { game } from '../stores/game'
	import { elapsedSeconds, formatElapsedTime } from '../stores/timer'
</script>

<div
	class="text-primary-green text-sm font-semibold text-left flex items-center gap-2"
>
	<TimerIcon size={24} />
	{#if $game.status === 'idle'}
		--:--
	{:else}
		{formatElapsedTime($elapsedSeconds)}
	{/if}
</div>
