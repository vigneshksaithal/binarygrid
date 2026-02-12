<script lang="ts">
	let { class: className = "size-8" }: { class?: string } = $props();
</script>

<svg class="relative z-10 {className}" viewBox="0 0 100 100">
	<circle
		cx="50"
		cy="50"
		r="35"
		fill="none"
		stroke="currentColor"
		stroke-width="16"
	/>
</svg>
