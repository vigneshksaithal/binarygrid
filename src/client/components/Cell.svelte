<script lang="ts">
	export let value: 0 | 1 | null = null
	export let fixed: boolean = false
	export let onClick: () => void = () => {}

	const label = fixed ? 'Fixed cell' : 'Editable cell'
</script>

<button
	type="button"
	class="aspect-square w-full flex items-center justify-center border border-green-700 font-mono text-sm sm:text-lg md:text-xl lg:text-2xl focus:outline-none focus:ring-2 focus:ring-green-500/60 disabled:opacity-70 disabled:cursor-not-allowed transition-colors hover:bg-green-500/10 shadow-[inset_0_0_10px_rgba(34,197,94,0.2),0_0_10px_rgba(34,197,94,0.15)]"
	onclick={onClick}
	aria-label={label}
	disabled={fixed}
>
	{#if value === null}
		·
	{:else if value === 0}
		0
	{:else}
		1
	{/if}
</button>
