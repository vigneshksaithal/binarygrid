<script lang="ts">
import { closeHowTo, showHowTo } from '../stores/ui'
import Button from './Button.svelte'
</script>

{#if $showHowTo}
	<section
		class="fixed inset-0 z-50 grid place-items-center bg-[rgb(var(--color-secondary-black-rgb)/0.7)]"
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="how-to-modal-title"
			aria-describedby="how-to-modal-body"
			class="grid w-11/12 max-w-2xl gap-6 border border-border-green bg-modal p-6 text-tertiary-gray shadow-2xl"
		>
			<h2 id="how-to-modal-title" class="text-xl text-primary-green">
				How to Play
			</h2>
			<section id="how-to-modal-body" class="space-y-3 text-tertiary-gray">
				<ul class="list-disc space-y-2 ps-6">
					<li>Tap cells to switch: blank → 0 → 1.</li>
					<li>No 000 or 111 in any line.</li>
					<li>Each row and column must have 3 zeros and 3 ones.</li>
					<li>All rows and columns must differ.</li>
					<li>Gray cells stay fixed.</li>
					<li>Solved board auto-submits and reveals today’s ASCII.</li>
				</ul>
			</section>
			<footer class="flex justify-end">
				<Button type="button" onClick={closeHowTo}>Got it</Button>
			</footer>
		</div>
	</section>
{/if}
