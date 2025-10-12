<script lang="ts">
import { closeHowTo, showHowToModal } from '../stores/ui'
import Button from './Button.svelte'
</script>

{#if $showHowToModal}
	<section class="fixed inset-0 z-50 grid place-items-center p-4">
		<div
			class="w-full max-w-lg p-6 rounded-xl shadow-md bg-zinc-800"
			role="dialog"
			aria-modal="true"
			aria-labelledby="how-to-modal-title"
			aria-describedby="how-to-modal-body"
		>
			<h2 id="how-to-modal-title">How to Play</h2>
			<div id="how-to-modal-body">
				<p class="font-semibold">
					Fill the grid so every row and column has exactly 3 zeros and 3 ones.
				</p>
				<ul>
					<li>Tap any cell to cycle through: empty → 0 → 1</li>
					<li>Watch out: you can't have three of the same number in a row</li>
					<li>Gray cells are fixed and can't be changed</li>
					<li>When you solve it, the game automatically submits your answer</li>
				</ul>
			</div>
			<footer>
				<Button onClick={closeHowTo}>Got it</Button>
			</footer>
		</div>
	</section>
{/if}
