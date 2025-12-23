<script lang="ts">
	import Circle from './Circle.svelte'
	import Line from './Line.svelte'

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
			classes.push('border-r-2 border-r-zinc-300 dark:border-r-zinc-600')
		}
		if (row < 5) {
			classes.push('border-b-2 border-b-zinc-300 dark:border-b-zinc-600')
		}

		return classes.join(' ')
	})
</script>

<button
	type="button"
	class="relative aspect-square flex items-center justify-center text-zinc-800 dark:text-zinc-200 focus:outline-none disabled:cursor-not-allowed transition-colors hover:bg-black/10 dark:hover:bg-white/10 {fixed
		? 'bg-zinc-200 dark:bg-zinc-700'
		: ''} {borderClass}"
	onclick={handleClick}
	aria-label={label}
	disabled={fixed}
>
	{#if value === 0}
		<Circle />
	{:else if value === 1}
		<Line />
	{/if}
	{#if hasError}
		<svg
			class="absolute inset-0 w-full h-full pointer-events-none stroke-red-400"
			viewBox="0 0 100 100"
			preserveAspectRatio="none"
		>
			<line
				x1="20"
				y1="20"
				x2="80"
				y2="80"
				stroke-width="6"
				stroke-linecap="round"
			/>
			<line
				x1="80"
				y1="20"
				x2="20"
				y2="80"
				stroke-width="6"
				stroke-linecap="round"
			/>
		</svg>
	{/if}
</button>
