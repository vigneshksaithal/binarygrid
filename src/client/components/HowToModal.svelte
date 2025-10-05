<script lang="ts">
import { closeHowTo, showHowTo } from '../stores/ui'
import Button from './Button.svelte'
</script>

{#if $showHowTo}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="how-to-modal-title"
			aria-describedby="how-to-modal-body"
			class="w-11/12 max-w-2xl border border-green-700 bg-black p-6 text-green-300 shadow-2xl"
		>
			<div class="mb-4 flex items-center justify-between">
				<h2 id="how-to-modal-title" class="text-2xl text-green-400">How to Play</h2>
			</div>
			<div id="how-to-modal-body" class="space-y-3 text-green-200">
				<p>Fill every cell with 0 or 1.</p>
				<ul class="list-disc space-y-2 pl-6">
					<li>Tap a cell to cycle: ▢ → 0 → 1 → ▢</li>
					<li>No triples: 000 or 111 in any row/column ✖</li>
					<li>Balance each line: 3 zeros and 3 ones ⚖</li>
					<li>Gray cells are fixed 🔒 (you can't change them)</li>
					<li>Win to reveal Today’s ASCII Character 🎁</li>
				</ul>
				<p class="text-sm">When all rules are met, the game will auto-submit ⏱</p>
			</div>
			<div class="mt-6 text-right">
				<Button onClick={closeHowTo}>Got it</Button>
			</div>
		</div>
	</div>
{/if}
