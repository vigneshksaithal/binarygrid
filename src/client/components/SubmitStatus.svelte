<script lang="ts">
	import { promptLogin } from '../services/login-prompt'
	import {
		resubmitAfterLogin,
		retrySubmit,
		submitStatus,
		type SubmitStatus,
	} from '../stores/submit'
	import Button from './Button.svelte'

	const STATUS_TEXT: Record<SubmitStatus, string> = {
		idle: '',
		saving: 'Saving…',
		saved: '✓ Saved',
		failed: "Couldn't save ·",
		login_required: "Logged out: this time isn't saved.",
	}

	const STATUS_COLOR: Record<SubmitStatus, string> = {
		idle: '',
		saving: 'text-zinc-600 dark:text-zinc-300',
		saved: 'text-emerald-700 dark:text-emerald-400',
		failed: 'text-red-700 dark:text-red-400',
		login_required: 'text-zinc-700 dark:text-zinc-200',
	}

	// The webview may survive the login prompt (unverified); coming back resends the held solve.
	const resubmitWhenVisible = () => {
		if (!document.hidden) resubmitAfterLogin()
	}
</script>

<svelte:window onfocus={resubmitAfterLogin} />
<svelte:document onvisibilitychange={resubmitWhenVisible} />

<!-- A fixed height, so a status change never moves the buttons below it. -->
<div class="flex h-8 items-center justify-center gap-2 text-xs font-semibold">
	<span role="status" class={STATUS_COLOR[$submitStatus]}>{STATUS_TEXT[$submitStatus]}</span>
	{#if $submitStatus === 'failed'}
		<Button size="sm" variant="secondary" onClick={retrySubmit}>Retry</Button>
	{:else if $submitStatus === 'login_required'}
		<Button size="sm" variant="secondary" onClick={promptLogin}>Log in</Button>
	{/if}
</div>
