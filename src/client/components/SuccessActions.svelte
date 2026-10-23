<script lang="ts">
	import { context } from '@devvit/web/client'
	import { onMount } from 'svelte'
	import type { Attachment } from 'svelte/attachments'
	import type { Difficulty } from '../../shared/types/puzzle'
	import { game, loadPuzzle } from '../stores/game'
	import { trackGrowthEvent } from '../stores/growth'
	import { formatJoinLabel, JOIN_FAILED_MESSAGE, joinCurrentSubreddit } from '../stores/join'
	import { resetAllShareState, resetShareState, shareState } from '../stores/share'
	import { elapsedSeconds, startTimer } from '../stores/timer'
	import { closeSuccessModal, hasJoinedSubreddit, setHasJoinedSubreddit } from '../stores/ui'
	import Button from './Button.svelte'
	import ScoreCommentPreview from './ScoreCommentPreview.svelte'

	type Props = {
		dayNumber: number | null
		streak: number
	}

	const { dayNumber, streak }: Props = $props()

	// The Devvit context is missing outside Reddit (local `vite dev`)
	const subredditName: string | undefined = context?.subredditName
	const username: string | undefined = context?.username

	let isPreviewOpen = $state(false)
	let isJoining = $state(false)
	let joinError = $state<string | null>(null)
	let shouldRestoreFocus = false

	const getNextDifficulty = (current: Difficulty): Difficulty => {
		if (current === 'easy') return 'medium'
		if (current === 'medium') return 'hard'
		return 'easy'
	}

	const playAnotherDifficulty = async () => {
		await loadPuzzle(getNextDifficulty($game.difficulty))
		startTimer()
	}

	const fetchJoinedStatus = async () => {
		try {
			const res = await fetch('/api/check-joined-status')
			if (res.ok) {
				const data = await res.json()
				setHasJoinedSubreddit(data.hasJoined)
			}
		} catch (error) {
			console.error('Failed to check joined status', error)
		}
	}

	const joinSubreddit = async () => {
		if (isJoining) return
		isJoining = true
		joinError = null
		trackGrowthEvent('join_click')
		const result = await joinCurrentSubreddit()
		isJoining = false
		if (!result.ok) {
			joinError = result.error
			return
		}
		trackGrowthEvent('join_success')
		closeSuccessModal()
	}

	// Comment my score: preview the exact text first; only Post posts
	const openPreview = () => {
		resetShareState()
		isPreviewOpen = true
		trackGrowthEvent('share_preview')
	}

	const closePreview = () => {
		shouldRestoreFocus = true
		isPreviewOpen = false
	}

	// Hand focus back to the buttons the preview replaced
	const restoreFocus: Attachment<HTMLElement> = (element) => {
		if (!shouldRestoreFocus) return
		shouldRestoreFocus = false
		element.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
	}

	// The modal unmounts this row when it closes, so each solve starts fresh
	onMount(() => {
		resetAllShareState()
		fetchJoinedStatus()
	})
</script>

<!-- The preview replaces these buttons in place, so nothing slides in above them -->
<div class="space-y-2">
	{#if isPreviewOpen && dayNumber !== null}
		<ScoreCommentPreview
			{dayNumber}
			solveTimeSeconds={$elapsedSeconds}
			difficulty={$game.difficulty}
			{streak}
			{username}
			onClose={closePreview}
		/>
	{:else}
		<div class="space-y-2" {@attach restoreFocus}>
			<Button
				class="w-full"
				onClick={openPreview}
				disabled={$shareState.shareSuccess === true || dayNumber === null}
			>
				{$shareState.shareSuccess === true ? '✓ Comment posted' : 'Comment my score'}
			</Button>

			<Button class="w-full" variant="secondary" onClick={playAnotherDifficulty}>
				{#if $game.difficulty === 'easy'}
					Try Medium →
				{:else if $game.difficulty === 'medium'}
					Try Hard →
				{:else}
					Try Easy →
				{/if}
			</Button>

			{#if !$hasJoinedSubreddit}
				<Button class="w-full" variant="secondary" onClick={joinSubreddit} disabled={isJoining}>
					{#if isJoining}
						Joining…
					{:else if joinError === JOIN_FAILED_MESSAGE}
						Retry
					{:else}
						🎮 {formatJoinLabel(subredditName)}
					{/if}
				</Button>
				{#if joinError}
					<p role="alert" class="text-xs text-red-700 dark:text-red-400 text-center mb-0">{joinError}</p>
				{/if}
			{/if}
		</div>
	{/if}
	<p class="sr-only" aria-live="polite">
		{$shareState.shareSuccess === true ? 'Comment posted' : ''}
	</p>
</div>
