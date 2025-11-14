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
		class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-100/40 dark:bg-neutral-900/50 backdrop-blur-[0.25px]"
	>
		<button
			type="button"
			onclick={handlePlay}
			class="animate-bounce text-xl tracking-wide font-extrabold text-neutral-900 dark:text-neutral-100 bg-green-500/90 dark:bg-green-600/90 border-2 border-green-400/50 dark:border-green-500/50 hover:bg-green-600/95 dark:hover:bg-green-500/95 hover:border-green-400/80 dark:hover:border-green-500/80 hover:scale-105 rounded-full px-6 py-3 shadow-2xl shadow-green-500/30 dark:shadow-green-500/20 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-500 focus-visible:ring-offset-4"
			aria-label="Start playing"
		>
			PLAY
		</button>
	</div>
{/if}
