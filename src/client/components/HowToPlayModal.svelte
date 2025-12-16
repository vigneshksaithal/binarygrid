<script lang="ts">
	import { closeHowTo, showHowToModal } from '../stores/ui'
	import Modal from './Modal.svelte'
</script>

<Modal
	open={$showHowToModal}
	onClose={closeHowTo}
	labelledby="how-to-modal-title"
	describedby="how-to-modal-body"
>
	<h2 id="how-to-modal-title">How to Play</h2>
	<div id="how-to-modal-body">
		<ol>
			<li>Tap any cell to cycle through: empty → 0 → 1</li>
			<li>Fill the grid so every row and column has 3 zeros and 3 ones.</li>
			<li>No triples in any row or column, 000 or 111.</li>
		</ol>
	</div>
</Modal>
