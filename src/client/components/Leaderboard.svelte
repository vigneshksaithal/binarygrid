<script lang="ts">
  import { onMount } from 'svelte'
  import { client } from '@devvit/web/client'
  import { leaderboard } from '../stores/leaderboard'
  import LeaderboardRow from './LeaderboardRow.svelte'

  let postId: string | undefined

  onMount(async () => {
    leaderboard.fetchTop()
    leaderboard.fetchMe()
  })
</script>

<div class="w-full bg-zinc-800 rounded-3xl p-4">
  <h2 class="text-xl font-bold mb-4">Leaderboard</h2>
  {#if $leaderboard.loading}
    <p>Loading...</p>
  {:else if $leaderboard.error}
    <p class="text-red-500">{$leaderboard.error}</p>
  {:else if $leaderboard.top.length === 0}
    <p>Be the first to score!</p>
  {:else}
    <div>
      {#each $leaderboard.top as entry}
        <LeaderboardRow {entry} />
      {/each}
    </div>
    {#if $leaderboard.me && !$leaderboard.top.some(e => e.rank === $leaderboard.me.rank)}
      <div class="mt-4 pt-4 border-t border-zinc-700">
        {#each $leaderboard.peers as entry}
          <LeaderboardRow {entry} />
        {/each}
      </div>
    {/if}
  {/if}
</div>
