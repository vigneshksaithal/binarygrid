<script lang="ts">
	import { promptLogin } from '../services/login-prompt'
	import { pendingSolves, resubmitAfterLogin, retryPendingSolve, submitStatus } from '../stores/submit'
	import { showSuccessModal } from '../stores/ui'
	import Button from './Button.svelte'
	import SubmitStatus from './SubmitStatus.svelte'

	const resubmitWhenVisible = () => {
		if (!document.hidden) void resubmitAfterLogin()
	}

	const difficultyLabel = (puzzleId: string): string => {
		const difficulty = puzzleId.split(':').at(-1)
		if (difficulty === 'easy') return 'Easy'
		if (difficulty === 'medium') return 'Medium'
		if (difficulty === 'hard') return 'Hard'
		return 'Earlier'
	}
</script>

<svelte:window onfocus={resubmitAfterLogin} />
<svelte:document onvisibilitychange={resubmitWhenVisible} />

{#if !$showSuccessModal && ($submitStatus === 'saving' || $submitStatus === 'failed' || $submitStatus === 'login_required')}
	<div class="mt-2 rounded-lg bg-amber-100 p-2 text-xs text-amber-950 dark:bg-amber-950 dark:text-amber-100">
		<p class="m-0 text-center font-semibold">Current result</p>
		<SubmitStatus />
		<p class="m-0 text-center">Keep this game open until your result is saved.</p>
	</div>
{/if}

{#if $pendingSolves.length > 0}
	<div class="mt-2 rounded-lg bg-amber-100 p-2 text-xs text-amber-950 dark:bg-amber-950 dark:text-amber-100" aria-label="Earlier unsaved results">
		<p class="m-0 font-semibold">Earlier results waiting to save</p>
		{#each $pendingSolves as solve (solve.attemptId)}
			<div class="flex items-center justify-between gap-2 py-1">
				<span role="status">
					{difficultyLabel(solve.puzzleId)}:
					{solve.status === 'saving' ? 'Saving…' : solve.status === 'login_required' ? 'Log in to save' : "Couldn't save"}
				</span>
				{#if solve.status === 'failed'}
					<Button size="sm" variant="secondary" onClick={() => retryPendingSolve(solve.attemptId)}>Retry</Button>
				{:else if solve.status === 'login_required'}
					<Button size="sm" variant="secondary" onClick={promptLogin}>Log in</Button>
				{/if}
			</div>
		{/each}
		<p class="m-0">Keep this game open until your results are saved.</p>
	</div>
{/if}
