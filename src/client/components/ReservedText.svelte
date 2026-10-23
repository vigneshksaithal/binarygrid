<script lang="ts">
	type Props = {
		/** The line, or null until it's known. */
		text: string | null
		/** Every text the line may show later; the tallest sets its height from the start. */
		reserves: readonly string[]
		class?: string
	}

	const { text, reserves, class: className = '' }: Props = $props()
</script>

<!--
	The line and invisible copies of its possible texts share one grid cell, so a
	line that fills in late never moves what's below it, at any width or font.
-->
{#if text !== null || reserves.length > 0}
	<p class="grid {className}">
		{#each reserves as reserve (reserve)}
			<span class="invisible col-start-1 row-start-1" aria-hidden="true">{reserve}</span>
		{/each}
		<span class="col-start-1 row-start-1">{text ?? ''}</span>
	</p>
{/if}
