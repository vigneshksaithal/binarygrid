<script lang="ts">
	import { startTimer } from '../stores/timer'
	import { closePlayOverlay, showPlayOverlay } from '../stores/ui'

	const handlePlay = () => {
		closePlayOverlay()
		startTimer()
	}
</script>

{#if $showPlayOverlay}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-100/80 dark:bg-neutral-900/60 backdrop-blur-md"
	>
		<button
			type="button"
			onclick={handlePlay}
			class="animate-bounce text-4xl tracking-wide font-bold text-neutral-900 dark:text-neutral-100 bg-green-500 dark:bg-green-600 hover:bg-green-600 dark:hover:bg-green-500 rounded-full px-12 py-6 shadow-2xl shadow-green-500/50 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-500 focus-visible:ring-offset-4"
			aria-label="Start playing"
		>
			PLAY
		</button>
	</div>
{/if}
