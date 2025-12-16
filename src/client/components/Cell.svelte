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

		// Error state
		if (hasError) {
			classes.push('ring-2 ring-red-600 dark:ring-red-500 ring-inset')
		}

		return classes.join(' ')
	})
</script>

<button
	type="button"
	class="aspect-square font-mono font-extrabold text-2xl text-green-600 dark:text-green-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-inset disabled:cursor-not-allowed transition-colors hover:bg-green-500/10 dark:hover:bg-green-600/10 {fixed
		? 'bg-green-200 dark:bg-green-800'
		: ''} {borderClass}"
	onclick={handleClick}
	aria-label={label}
	disabled={fixed}
>
	{#if value === 0}0{:else if value === 1}1{/if}
</button>
