<script lang="ts">
import { fetchLeaderboard, game } from '../stores/game'
import { formatElapsedTime } from '../stores/timer'

const { leaderboard } = $game

const handleLoadMore = () => {
  if (leaderboard.nextCursor) {
    fetchLeaderboard(leaderboard.nextCursor)
  }
}
</script>

<div class="leaderboard">
  <h2 class="text-lg font-bold mb-2">Leaderboard</h2>
  {#if leaderboard.scores.length === 0}
    <p>No scores yet. Be the first!</p>
  {:else}
    <table class="w-full text-left">
      <thead>
        <tr>
          <th class="p-2">Rank</th>
          <th class="p-2">Player</th>
          <th class="p-2">Time</th>
        </tr>
      </thead>
      <tbody>
        {#each leaderboard.scores as entry, i}
          <tr>
            <td class="p-2">{i + 1}</td>
            <td class="p-2">{entry.member}</td>
            <td class="p-2">{formatElapsedTime(entry.score)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if leaderboard.nextCursor}
      <button
        class="w-full mt-4 p-2 bg-blue-500 text-white rounded"
        on:click={handleLoadMore}
        disabled={leaderboard.loading}
      >
        {leaderboard.loading ? 'Loading...' : 'Load More'}
      </button>
    {/if}
  {/if}
</div>