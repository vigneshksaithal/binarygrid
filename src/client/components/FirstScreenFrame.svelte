<script lang="ts">
	import { context } from '@devvit/web/client'
	import { formatTitleLine } from '../services/title-line'
	import { puzzleNumber } from '../stores/puzzle-number'
	import Glyph from './Glyph.svelte'

	type Props = {
		/** Holds the frame's room with its lines invisible, to screen readers too. */
		placeholder?: boolean
	}

	const { placeholder = false }: Props = $props()

	// The Devvit context is missing outside Reddit (local `vite dev`)
	const subredditName: string | undefined = context?.subredditName
</script>

<!-- What this is, the rules in one line and what a tap does; no header block, so the grid stays in view -->
<div
	class="mb-2 space-y-0.5 text-center {placeholder ? 'invisible' : ''}"
	aria-hidden={placeholder ? 'true' : undefined}
>
	<p class="mb-0 truncate text-sm font-bold text-zinc-800 dark:text-zinc-200">
		{formatTitleLine($puzzleNumber, subredditName)}
	</p>
	<p class="mb-0 text-xs tracking-normal text-zinc-600 dark:text-zinc-400">
		3 <Glyph value={0} label="circles" /> and 3 <Glyph value={1} label="lines" /> per row and column · no 3 in
		a row
	</p>
	<p class="mb-0 text-xs tracking-normal text-zinc-600 dark:text-zinc-400">
		Tap a cell: <Glyph value={0} /> → <Glyph value={1} /> → empty
	</p>
</div>
