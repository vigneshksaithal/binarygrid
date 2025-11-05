<script lang="ts">
  import { formatElapsedTime } from '../stores/timer'
  import { game } from '../stores/game'
  import {
    closeLeaderboardModal,
    showLeaderboardModal
  } from '../stores/ui'
  import {
    goToLeaderboardPage,
    leaderboard,
    loadLeaderboard,
    resetLeaderboard
  } from '../stores/leaderboard'
  import Button from './Button.svelte'
  import Modal from './Modal.svelte'

  let lastLoadedPuzzleId = $state<string | null>(null)

  const handleClose = () => {
    closeLeaderboardModal()
    resetLeaderboard()
    lastLoadedPuzzleId = null
  }

  const showPlayerSummary = () => {
    const state = $leaderboard
    if (!state.playerEntry) {
      return false
    }
    return !state.entries.some(
      (entry) => entry.userId === state.playerEntry?.userId
    )
  }

  const goToNextPage = () => {
    if (!$leaderboard.hasNextPage) {
      return
    }
    goToLeaderboardPage($leaderboard.page + 1)
  }

  const goToPreviousPage = () => {
    if (!$leaderboard.hasPreviousPage) {
      return
    }
    goToLeaderboardPage(Math.max(0, $leaderboard.page - 1))
  }

  const formatRankLabel = (rank: number) => `#${rank}`

  const getAvatarInitial = (username: string) =>
    username.slice(0, 1).toUpperCase()

  $effect(() => {
    if (!$showLeaderboardModal) {
      return
    }
    const puzzleId = $game.puzzleId
    if (!puzzleId) {
      return
    }
    if ($leaderboard.status === 'idle' || lastLoadedPuzzleId !== puzzleId) {
      lastLoadedPuzzleId = puzzleId
      loadLeaderboard(puzzleId)
    }
  })
</script>

<Modal
  open={$showLeaderboardModal}
  labelledby="leaderboard-title"
  describedby="leaderboard-description"
>
  <header class="space-y-1 mb-4">
    <h2 id="leaderboard-title">
      Leaderboard
    </h2>
  </header>

{#if $leaderboard.status === 'loading'}
  <div class="flex flex-col items-center gap-3 py-10" role="status" aria-live="polite">
    <div
      class="size-6 rounded-full border-2 border-primary-green border-t-transparent animate-spin"
      aria-hidden="true"
    ></div>
    <p class="text-sm">Loading leaderboard…</p>
  </div>
  {:else if $leaderboard.status === 'error'}
  <div class="rounded-lg bg-error/10 p-4 text-sm text-error">
    {$leaderboard.error ?? 'Unable to load leaderboard. Please try again.'}
  </div>
  {:else}
  <div class="space-y-3">
    {#if $leaderboard.entries.length === 0}
    <p class="text-sm">
      No leaderboard entries yet. Be the first to submit a blazing-fast time!
    </p>
    {:else}
    <ol class="space-y-2">
      {#each $leaderboard.entries as entry (entry.userId)}
      <li
        class={`flex items-center gap-3 p-3 rounded-lg bg-zinc-800/80 border border-transparent hover:border-primary-green/40 transition-colors ${
          entry.userId === $leaderboard.playerEntry?.userId
            ? 'bg-primary-green/10 border-primary-green/60'
            : ''
        }`}
      >
        <p class="w-8 text-sm font-semibold text-primary-green">
          {formatRankLabel(entry.rank)}
        </p>
        {#if entry.avatarUrl}
        <img
          alt={`${entry.username}'s avatar`}
          src={entry.avatarUrl}
          class="size-8 rounded-full object-cover border border-primary-green/60"
          loading="lazy"
        />
        {:else}
        <div
          class="size-8 rounded-full bg-zinc-700 text-zinc-300 grid place-items-center text-sm font-semibold"
          aria-hidden="true"
        >
          {getAvatarInitial(entry.username)}
        </div>
        {/if}
        <div class="flex-1">
          <p class="text-sm font-semibold text-zinc-100">{entry.username}</p>
        </div>
        <p class="text-sm font-semibold text-primary-green">
          {formatElapsedTime(Math.round(entry.timeSeconds))}
        </p>
      </li>
      {/each}
    </ol>
    {/if}

    {#if showPlayerSummary()}
    <div class="rounded-lg border border-primary-green/50 bg-primary-green/10 p-4 text-sm text-zinc-100">
      <h3 class="text-primary-green">
        Your ranking
      </h3>
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-primary-green">
          {formatRankLabel($leaderboard.playerEntry?.rank ?? 0)}
        </span>
        {#if $leaderboard.playerEntry?.avatarUrl}
        <img
          alt="Your avatar"
          src={$leaderboard.playerEntry.avatarUrl}
          class="size-6 rounded-full object-cover border border-primary-green/60"
          loading="lazy"
        />
        {:else}
        <div
          class="size-6 rounded-full bg-zinc-700 text-zinc-300 grid place-items-center text-xs font-semibold"
          aria-hidden="true"
        >
          {getAvatarInitial($leaderboard.playerEntry?.username ?? '?')}
        </div>
        {/if}
        <div class="flex-1">
          <p class="text-sm font-semibold">
            {$leaderboard.playerEntry?.username ?? 'You'}
          </p>
          <p class="text-xs text-zinc-300">
            Time: {formatElapsedTime(
              Math.round($leaderboard.playerEntry?.timeSeconds ?? 0)
            )}
          </p>
        </div>
      </div>
    </div>
    {/if}

    {#if $leaderboard.entries.length > 0}
    <footer class="flex items-center justify-between pt-2">
      <Button
        variant="secondary"
        onClick={goToPreviousPage}
        disabled={!$leaderboard.hasPreviousPage}
      >
        Previous
      </Button>
      <span class="text-xs text-zinc-400">
        Page {$leaderboard.page + 1}
      </span>
      <Button variant="secondary" onClick={goToNextPage} disabled={!$leaderboard.hasNextPage}>
        Next
      </Button>
    </footer>
    {/if}
  </div>
  {/if}

  <footer class="mt-6 flex justify-end">
    <Button onClick={handleClose}>Done</Button>
  </footer>
</Modal>
