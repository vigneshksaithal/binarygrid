<script lang="ts">
	type Props = { coins: number; onClick?: () => void }
	let { coins, onClick }: Props = $props()
</script>

<button
	onclick={onClick}
	class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
	aria-label="Open shop"
>
	<span class="text-sm">🪙</span>
	<span class="text-sm font-bold text-yellow-400">{coins}</span>
</button>
