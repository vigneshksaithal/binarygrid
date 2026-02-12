<script lang="ts">
	let { class: className = "size-8" }: { class?: string } = $props();
</script>

<svg class="relative z-10 {className}" viewBox="0 0 100 100">
	<line
		x1="50"
		y1="20"
		x2="50"
		y2="80"
		stroke="currentColor"
		stroke-width="16"
		stroke-linecap="round"
	/>
</svg>
