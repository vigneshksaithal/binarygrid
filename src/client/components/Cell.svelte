<script lang="ts">
export let value: 0 | 1 | null = null
export let fixed: boolean = false
export let onClick: () => void = () => {}

const label = fixed ? 'Fixed cell' : 'Editable cell'
</script>

<button
	type="button"
	class="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center border border-green-700 font-mono text-xl md:text-2xl focus:outline-none focus:ring-2 focus:ring-green-500/60 disabled:opacity-70 disabled:cursor-not-allowed transition-colors hover:bg-green-500/10"
	on:click={onClick}
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
