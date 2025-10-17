<script lang="ts">
import { streak } from '../stores/streak'
import { elapsedSeconds, formatElapsedTime } from '../stores/timer'
import { closeSuccessModal, showSuccessModal } from '../stores/ui'

import Button from './Button.svelte'
import Leaderboard from './Leaderboard.svelte'

let isJoining = $state(false)

const formatDays = (value: number): string => {
  const absolute = Math.max(0, Math.floor(value))
  const suffix = absolute === 1 ? 'day' : 'days'
  return `${absolute} ${suffix}`
}

const joinSubreddit = async () => {
  if (isJoining) {
    return
  }
  isJoining = true
  try {
    const res = await fetch('/api/join-subreddit')
    if (res.ok) {
      closeSuccessModal()
    } else {
      // biome-ignore lint/suspicious/noConsole: surface failure in devtools
      console.error('Failed to join subreddit')
    }
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: surface failure in devtools
    console.error('Failed to join subreddit', error)
  } finally {
    isJoining = false
  }
}
</script>

{#if $showSuccessModal}
	<section class="fixed inset-0 z-50 grid place-items-center p-4">
		<div
			class="w-full max-w-lg gap-6 p-6 rounded-xl shadow-md grid bg-zinc-800"
			role="dialog"
			aria-modal="true"
			aria-labelledby="success-modal-title"
			aria-describedby="success-modal-body"
		>
			<h2
				id="success-modal-title"
				class="text-center text-primary-green text-2xl font-semibold"
			>
				Congratulations!
			</h2>
			<div id="success-modal-body" class="grid gap-3 text-center text-zinc-100">
				<p class="text-lg font-semibold">
					You solved the puzzle in
					<span class="text-primary-green"
						>{formatElapsedTime($elapsedSeconds)}</span
					>.
				</p>
				<div class="grid gap-1 text-sm text-zinc-300">
					<p>
						Current streak:
						<span class="text-primary-green font-semibold"
							>{formatDays($streak.current)}</span
						>
					</p>
					<p>
						Best streak:
						<span class="text-primary-green font-semibold"
							>{formatDays($streak.longest)}</span
						>
					</p>
				</div>
				<p class="text-sm text-zinc-300">
					Join r/binarygrid for daily challenges.
				</p>
			</div>
      <Leaderboard />
			<footer class="grid gap-3">
				<button
					type="button"
					class="text-sm font-medium text-zinc-300 hover:text-primary-green transition-colors"
					onclick={closeSuccessModal}
				>
					Maybe later
				</button>
				<Button onClick={joinSubreddit} disabled={isJoining}>
					{#if isJoining}
						Joining…
					{:else}
						Join r/binarygrid
					{/if}
				</Button>
			</footer>
		</div>
	</section>
{/if}
