<script lang="ts">
import { closeHowTo, showHowToModal } from '../stores/ui'
import Button from './Button.svelte'
</script>

{#if $showHowToModal}
	<section class="fixed inset-0 z-50 grid place-items-center p-4">
		<div
			class="w-full max-w-lg gap-6 p-6 rounded-xl shadow-md grid bg-zinc-800"
			role="dialog"
			aria-modal="true"
			aria-labelledby="how-to-modal-title"
			aria-describedby="how-to-modal-body"
		>
			<h2 id="how-to-modal-title">How to Play</h2>
			<div id="how-to-modal-body">
				<p class="mb-2 font-semibold">
					Goal: All cells should have zeros and ones.
				</p>
				<ol class="list-decimal list-inside mb-2">
					<li>Tap cells to switch: blank → 0 → 1.</li>
					<li>No continuous 000s and 111s in any row or column.</li>
					<li>Each row and column must have 3 zeros and 3 ones.</li>
				</ol>
				<ul>
					<li>Gray cells stay fixed.</li>
					<li>Solved board auto-submits.</li>
				</ul>
			</div>
			<footer>
				<Button onClick={closeHowTo}>Got it</Button>
			</footer>
		</div>
	</section>
{/if}
