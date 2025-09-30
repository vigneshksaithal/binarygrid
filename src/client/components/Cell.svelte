<script lang="ts">
const {
	value = null,
	fixed = false,
	onClick = () => {}
}: {
	value?: 0 | 1 | null
	fixed?: boolean
	onClick?: () => void
} = $props()

const label = fixed ? 'Fixed cell' : 'Editable cell'
</script>

<button
	type="button"
	class="aspect-square w-full flex items-center justify-center border border-green-700 font-mono font-semibold text-sm sm:text-lg md:text-xl lg:text-2xl focus:outline-none focus:ring-2 focus:ring-green-500/60 disabled:opacity-70 disabled:cursor-not-allowed transition-colors hover:bg-green-500/10 shadow-[inset_0_0_10px_rgba(34,197,94,0.2),0_0_10px_rgba(34,197,94,0.15)] relative {fixed
		? 'bg-green-500/10'
		: ''}"
	onclick={onClick}
	aria-label={label}
	disabled={fixed}
>
	{#if fixed}
		<span class="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-green-400/90"
		></span>
	{/if}
	{#if value === 0}
		0
	{:else if value === 1}
		1
	{/if}
</button>
