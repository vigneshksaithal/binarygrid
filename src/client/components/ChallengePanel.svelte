<script lang="ts">
    import { onMount } from "svelte";
    import {
        challengeStore,
        startPendingPolling,
        stopAllPolling,
    } from "../stores/challenge";
    import ChallengeCreate from "./ChallengeCreate.svelte";
    import ChallengeList from "./ChallengeList.svelte";
    import ChallengeRace from "./ChallengeRace.svelte";

    const {
        puzzleId,
        isAuthenticated,
    }: { puzzleId: string; isAuthenticated: boolean } = $props();

    const activeChallenge = $derived($challengeStore.active);

    onMount(() => {
        startPendingPolling();
        return () => stopAllPolling();
    });
</script>

{#if isAuthenticated}
    <div class="flex flex-col gap-4">
        {#if activeChallenge !== null}
            <ChallengeRace challenge={activeChallenge} />
        {/if}

        <ChallengeList />

        <ChallengeCreate {puzzleId} />
    </div>
{/if}
