<script lang="ts">
	import type { Attachment } from 'svelte/attachments'
	import {
		formatScoreShareText,
		getShareMode,
		MAX_OWN_WORDS_LENGTH,
	} from '../../shared/share-formatter'
	import type { Difficulty } from '../../shared/types/puzzle'
	import { trackGrowthEvent } from '../stores/growth'
	import {
		buildScoreShareRequest,
		describeShareDestination,
		SHARE_FAILED_MESSAGE,
		shareState,
		shareToReddit,
	} from '../stores/share'
	import Button from './Button.svelte'

	type Props = {
		dayNumber: number
		solveTimeSeconds: number
		difficulty: Difficulty
		streak: number
		username: string | undefined
		onClose: () => void
	}

	const { dayNumber, solveTimeSeconds, difficulty, streak, username, onClose }: Props = $props()

	const uid = $props.id()
	let ownWords = $state('')

	// The preview and Post both read this request, so the player sees exactly what posts
	const request = $derived(
		buildScoreShareRequest({ dayNumber, solveTimeSeconds, difficulty, streak, customText: ownWords }),
	)
	const previewText = $derived(formatScoreShareText(request))
	const destination = $derived(describeShareDestination(getShareMode(request), username))
	const postLabel = $derived.by(() => {
		if ($shareState.isSharing) return 'Posting…'
		return $shareState.shareError === SHARE_FAILED_MESSAGE ? 'Retry' : 'Post'
	})

	// Screen readers start at the preview rather than losing focus with the removed button
	const focusOnOpen: Attachment<HTMLElement> = (element) => {
		element.focus()
	}

	const postComment = async () => {
		if ($shareState.isSharing) return
		const posted = await shareToReddit(request)
		if (!posted) return
		trackGrowthEvent('share_success')
		onClose()
	}
</script>

<section
	class="space-y-2 text-left focus-visible:outline-none"
	aria-labelledby="{uid}-destination"
	tabindex="-1"
	{@attach focusOnOpen}
>
	<p id="{uid}-destination" class="text-xs text-zinc-400 mb-0">{destination}</p>
	<p
		class="rounded-xl bg-zinc-800/70 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 whitespace-pre-wrap wrap-break-word mb-0"
	>{previewText}</p>
	<label for="{uid}-own-words" class="block text-xs text-zinc-400">
		Add your own words (optional)
	</label>
	<textarea
		id="{uid}-own-words"
		bind:value={ownWords}
		maxlength={MAX_OWN_WORDS_LENGTH}
		rows="2"
		class="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
	></textarea>
	<div class="flex gap-2">
		<Button class="flex-1" onClick={postComment} disabled={$shareState.isSharing}>
			{postLabel}
		</Button>
		<Button class="flex-1" variant="secondary" onClick={onClose} disabled={$shareState.isSharing}>
			Cancel
		</Button>
	</div>
	{#if $shareState.shareError}
		<p role="alert" class="text-xs text-red-400 text-center mb-0">{$shareState.shareError}</p>
	{/if}
</section>
