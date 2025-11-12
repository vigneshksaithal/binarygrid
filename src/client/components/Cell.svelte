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

	const borderClass = $derived((hasError && 'border-2 border-error') || '')
</script>

<button
	type="button"
	class="aspect-square w-full flex items-center justify-center font-mono font-bold text-lg md:text-xl focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors hover:bg-green-500/10 dark:hover:bg-green-600/10 relative {fixed
		? 'bg-green-500 dark:bg-green-600 text-neutral-900 dark:text-neutral-100'
		: ''} {borderClass}"
	onclick={handleClick}
	aria-label={label}
	disabled={fixed}
>
	{#if value === 0}0{:else if value === 1}1{/if}
</button>
