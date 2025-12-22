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
			<li>
				Tap cells to cycle through: <span class="font-mono">0</span> →
				<span class="font-mono">1</span> → empty
			</li>
			<li>
				Fill the grid so that each cell contains either a <span
					class="font-mono">0</span
				>
				or a <span class="font-mono">1</span>.
			</li>
			<li>
				No more than 2 <span class="font-mono">0</span>s or
				<span class="font-mono">1</span>s may be next to each other, either
				vertically or horizontally.
			</li>
			<li>
				Each row and column must contain the same number of <span
					class="font-mono">0</span
				>s and <span class="font-mono">1</span>s.
			</li>
		</ol>
	</div>
</Modal>
