<script lang="ts">
	const {
		value = null,
		fixed = false,
		hasError = false,
		row = 0,
		col = 0,
		onClick,
	}: {
		value?: 0 | 1 | null
		fixed?: boolean
		hasError?: boolean
		row?: number
		col?: number
		onClick?: () => void
	} = $props()

	const handleClick = () => {
		if (onClick) {
			onClick()
		}
	}

	const label = $derived(fixed ? 'Fixed cell' : 'Editable cell')

	// Build border classes for clean matrix grid
	const borderClass = $derived.by(() => {
		const classes: string[] = []

		// Uniform borders (right + bottom), none at edges
		if (col < 5) {
			classes.push('border-r-2 border-r-zinc-400')
		}
		if (row < 5) {
			classes.push('border-b-2 border-b-zinc-400')
		}

		return classes.join(' ')
	})
</script>

<button
	type="button"
	class="relative aspect-square font-mono font-extrabold text-2xl text-green-600 dark:text-green-400 focus:outline-none disabled:cursor-not-allowed transition-colors hover:bg-green-500/10 dark:hover:bg-green-600/10 {fixed
		? 'bg-zinc-300 dark:bg-zinc-700'
		: ''} {borderClass}"
	onclick={handleClick}
	aria-label={label}
	disabled={fixed}
>
	{#if value === 0}<span class="relative z-10">0</span
		>{:else if value === 1}<span class="relative z-10">1</span>{/if}
	{#if hasError}
		<svg
			class="absolute inset-0 w-full h-full pointer-events-none"
			viewBox="0 0 100 100"
			preserveAspectRatio="none"
		>
			<line
				x1="20"
				y1="20"
				x2="80"
				y2="80"
				stroke="rgb(220 38 38 / 0.6)"
				stroke-width="6"
				stroke-linecap="round"
			/>
			<line
				x1="80"
				y1="20"
				x2="20"
				y2="80"
				stroke="rgb(220 38 38 / 0.6)"
				stroke-width="6"
				stroke-linecap="round"
			/>
		</svg>
	{/if}
</button>
