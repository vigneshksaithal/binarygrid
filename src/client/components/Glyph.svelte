<script lang="ts">
	import { GLYPH_NAMES } from '../services/cell-label'
	import Circle from './Circle.svelte'
	import Line from './Line.svelte'

	type Props = {
		value: 0 | 1
		/** What a screen reader says; the cell labels' "circle" or "line" unless the sentence needs a plural. */
		label?: string
	}

	const { value, label }: Props = $props()
</script>

<!-- A cell's glyph inside a line of text: a one-em square set level with the capitals, so the line keeps its height -->
<span role="img" aria-label={label ?? GLYPH_NAMES[value]} class="inline-block size-[1em] align-[-0.125em]">
	{#if value === 0}
		<Circle class="block size-full" />
	{:else}
		<Line class="block size-full" />
	{/if}
</span>
