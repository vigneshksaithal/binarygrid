<script lang="ts">
	const binarySequence = '0110100101101110011000010111001001111001'
</script>

<div class="flex items-center justify-center h-full" aria-label="Loading">
	<div class="grid grid-cols-6 gap-2 p-4 rounded-lg">
		{#each binarySequence.split('') as char, i}
			<div
				class="w-6 h-6 flex items-center justify-center text-lg font-mono rounded"
				style:animation-delay={`${i * 50}ms`}
				class:text-primary-green={char === '1'}
				class:text-zinc-600={char === '0'}
				class:animate-pulse={true}
			>
				{char}
			</div>
		{/each}
	</div>
</div>

<style>
	@keyframes pulse {
		50% {
			opacity: 0.3;
		}
	}

	.animate-pulse {
		animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
</style>