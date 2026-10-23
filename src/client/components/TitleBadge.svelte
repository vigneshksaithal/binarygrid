<script lang="ts">
	import type { PlayerTitle } from '../../shared/types/economy'

	type Props = { title: PlayerTitle | null }

	let { title }: Props = $props()
</script>

<!-- A bought title beside a player's name; the label is the tooltip and the screen-reader name. -->
{#if title}
	<span role="img" aria-label={title.label} title={title.label} class="flex-shrink-0 text-sm leading-none">
		{title.emoji}
	</span>
{/if}
