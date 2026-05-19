<script lang="ts">
    import { challengeStore } from "../stores/challenge";
    import ChallengeItem from "./ChallengeItem.svelte";

    const pending = $derived($challengeStore.pending);
</script>

<div class="flex flex-col gap-2">
    {#if pending.length === 0}
        <p class="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">
            No pending challenges
        </p>
    {:else}
        {#each pending as challenge (challenge.challengeId)}
            <ChallengeItem {challenge} />
        {/each}
    {/if}
</div>
