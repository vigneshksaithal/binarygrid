<div class="flex items-center justify-center h-full" aria-label="Loading">
	<div
		class="w-8 h-8 bg-primary-green rounded-lg animate-pulse"
	></div>
</div>

<style>
	@keyframes pulse {
		50% {
			opacity: 0.5;
			transform: scale(0.95);
		}
	}

	.animate-pulse {
		animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
</style>