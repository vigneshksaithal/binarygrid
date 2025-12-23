<script lang="ts">
	import confetti from 'canvas-confetti'
	import type { Difficulty } from '../../shared/types/puzzle'
	import { game, loadPuzzle } from '../stores/game'
	import { calculatePercentile, rankStore } from '../stores/rank'
	import { elapsedSeconds, formatElapsedTime, startTimer } from '../stores/timer'
	import {
		closeSuccessModal,
		hasJoinedSubreddit,
		setHasJoinedSubreddit,
		showSuccessModal,
	} from '../stores/ui'
	import Button from './Button.svelte'
	import Modal from './Modal.svelte'

	let isJoining = $state(false)
	let isCommenting = $state(false)
	let commentPosted = $state(false)

	const getNextDifficulty = (current: Difficulty): Difficulty => {
		if (current === 'easy') return 'medium'
		if (current === 'medium') return 'hard'
		return 'easy'
	}

	const playAnotherDifficulty = async () => {
		const currentDifficulty = $game.difficulty
		const nextDifficulty = getNextDifficulty(currentDifficulty)
		await loadPuzzle(nextDifficulty)
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
			// biome-ignore lint/suspicious/noConsole: we want to log the error
			console.error('Failed to check joined status', error)
		}
	}

	const joinSubreddit = async () => {
		if (isJoining) {
			return
		}
		isJoining = true

		try {
			const res = await fetch('/api/join-subreddit', {
				method: 'POST',
			})
			if (res.ok) {
				setHasJoinedSubreddit(true)
				closeSuccessModal()
			} else {
				// biome-ignore lint/suspicious/noConsole: we want to log the error
				console.error('Failed to join subreddit')
			}
		} catch (error) {
			// biome-ignore lint/suspicious/noConsole: we want to log the error
			console.error('Failed to join subreddit', error)
		} finally {
			isJoining = false
		}
	}

	const commentResult = async () => {
		if (isCommenting) {
			return
		}
		isCommenting = true

		try {
			const res = await fetch('/api/comment-score', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					solveTimeSeconds: $elapsedSeconds,
					difficulty: $game.difficulty,
				}),
			})
			if (res.ok) {
				commentPosted = true
			} else {
				// biome-ignore lint/suspicious/noConsole: we want to log the error
				console.error('Failed to comment result')
			}
		} catch (error) {
			// biome-ignore lint/suspicious/noConsole: we want to log the error
			console.error('Failed to comment result', error)
		} finally {
			isCommenting = false
		}
	}

	const showConfetti = () => {
		const CONFETTI_PARTICLE_COUNT = 100
		const CONFETTI_SPREAD = 70
		const CONFETTI_ORIGIN_Y = 0.6 // Vertical origin to start confetti lower on the screen

		confetti({
			particleCount: CONFETTI_PARTICLE_COUNT,
			spread: CONFETTI_SPREAD,
			origin: { y: CONFETTI_ORIGIN_Y },
		})
	}

	$effect(() => {
		if ($showSuccessModal) {
			showConfetti()
			commentPosted = false
			fetchJoinedStatus()
		}
	})
</script>

<Modal
	open={$showSuccessModal}
	onClose={closeSuccessModal}
	labelledby="success-modal-title"
	describedby="success-modal-body"
>
	<h2 id="success-modal-title">CONGRATS!</h2>
	<div id="success-modal-body" class="grid gap-2">
		<div class="mb-4 space-y-2">
			<p>
				<strong>Your time:</strong>
				{formatElapsedTime($elapsedSeconds)}
			</p>
			{#if $rankStore.rank !== null && $rankStore.totalEntries !== null}
				<p>
					<strong>Your rank:</strong> #{$rankStore.rank} - Top {calculatePercentile(
						$rankStore.rank,
						$rankStore.totalEntries,
					)}%
				</p>
			{/if}
		</div>
		<div class="flex flex-col gap-3 justify-center mb-6">
			{#if commentPosted}
				<p class="text-zinc-600 dark:text-zinc-400 font-semibold">
					Comment posted successfully!
				</p>
			{:else}
				<Button onClick={commentResult} disabled={isCommenting}>
					{#if isCommenting}
						Commenting…
					{:else}
						Comment Result
					{/if}
				</Button>
			{/if}
		</div>
	</div>
	{#if !$hasJoinedSubreddit}
		<hr class="border-b-2 border-green-400 dark:border-green-600 mb-4" />
		<p class="mb-6">[Join r/binarygrid for daily challenges.]</p>
	{/if}
	<footer class="flex flex-col gap-4">
		{#if !$hasJoinedSubreddit}
			<Button onClick={joinSubreddit} disabled={isJoining}>
				{#if isJoining}
					Joining…
				{:else}
					Join Subreddit
				{/if}
			</Button>
		{/if}
		<Button variant="ghost" onClick={playAnotherDifficulty}>
			Change Difficulty
		</Button>
	</footer>
</Modal>
