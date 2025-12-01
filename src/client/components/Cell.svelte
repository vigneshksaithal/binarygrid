<script lang="ts">
	const {
		value = null,
		fixed = false,
		hasError = false,
		onClick,
	}: {
		value?: 0 | 1 | null
		fixed?: boolean
		hasError?: boolean
		onClick?: () => void
	} = $props()

	const handleClick = () => {
		if (onClick) {
			onClick()
		}
	}

	const label = fixed ? 'Fixed cell' : 'Editable cell'

	const borderClass = $derived(
		(hasError && 'ring-2 ring-red-600 dark:ring-red-500') || '',
	)
</script>

<button
	type="button"
	class="aspect-square font-mono font-bold text-lg md:text-xl text-green-800 dark:text-green-400 focus:outline-none border border-green-600 dark:border-green-600 focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed transition-colors hover:bg-green-500/10 dark:hover:bg-green-600/10 relative {fixed
		? 'bg-green-300 dark:bg-green-900 text-green-700 dark:text-green-400'
		: ''} {borderClass}"
	onclick={handleClick}
	aria-label={label}
	disabled={fixed}
>
	{#if value === 0}0{:else if value === 1}1{/if}
</button>
