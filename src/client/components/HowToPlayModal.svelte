<script lang="ts">
	import { SOLVE_QUALITY_DEFINITIONS } from '../../shared/growth'
	import { closeHowTo, showHowToModal } from '../stores/ui'
	import Glyph from './Glyph.svelte'
	import Modal from './Modal.svelte'

	const labelDefinitions = Object.values(SOLVE_QUALITY_DEFINITIONS)
</script>

<Modal
	open={$showHowToModal}
	onClose={closeHowTo}
	labelledby="how-to-modal-title"
	describedby="how-to-modal-body"
>
	<h2 id="how-to-modal-title">How to Play</h2>
	<!-- The same ○ and | as the cells, never digits -->
	<div id="how-to-modal-body">
		<ol>
			<li>
				Tap a cell to change it: empty → <Glyph value={0} /> → <Glyph value={1} /> → empty.
			</li>
			<li>Fill every cell with a <Glyph value={0} /> or a <Glyph value={1} />.</li>
			<li>
				Every row and every column holds three <Glyph value={0} label="circles" /> and three
				<Glyph value={1} label="lines" />.
			</li>
			<li>Never three of the same in a row, across or down.</li>
			<li>Shaded cells are clues and can't be changed.</li>
		</ol>
	</div>
	<h3>Solve labels</h3>
	<ul>
		{#each labelDefinitions as definition (definition)}
			<li>{definition}</li>
		{/each}
	</ul>
</Modal>
