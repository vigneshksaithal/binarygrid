<script lang="ts">
    import { onMount } from "svelte";
    import {
        startActivePolling,
        stopAllPolling,
        submitChallengeTime,
        challengeStore,
    } from "../stores/challenge";
    import type { Challenge } from "../../shared/viral-types";
    import Button from "./Button.svelte";

    const { challenge }: { challenge: Challenge } = $props();

    // Track the latest challenge state from the store so we react to poll updates
    // svelte-ignore state_referenced_locally
    let liveChallenge = $state<Challenge>(challenge);

    let solveTimeInput = $state("");
    let submitting = $state(false);
    let submitted = $state(false);
    let error = $state<string | null>(null);

    const isFinished = $derived(liveChallenge.state === "finished");

    // Determine if the current user won (we know the winner's userId from the challenge)
    const winnerUsername = $derived(
        liveChallenge.winner === liveChallenge.challengerId
            ? liveChallenge.challengerUsername
            : liveChallenge.opponentUsername,
    );

    const marginSeconds = $derived(
        liveChallenge.margin !== undefined
            ? liveChallenge.margin.toFixed(1)
            : null,
    );

    // Sync store updates into local state
    const unsubscribe = challengeStore.subscribe((state) => {
        if (state.active && state.active.id === challenge.id) {
            liveChallenge = state.active;
        }
    });

    onMount(() => {
        // Start polling every 3 seconds while active (Req 14.1)
        if (liveChallenge.state === "active") {
            startActivePolling(challenge.id);
        }

        return () => {
            unsubscribe();
            stopAllPolling();
        };
    });

    const parsedSolveTime = $derived(() => {
        const n = Number.parseFloat(solveTimeInput);
        return Number.isFinite(n) && n >= 0 && n <= 3600 ? n : null;
    });

    const isValidTime = $derived(parsedSolveTime() !== null);

    const handleSubmit = async () => {
        const time = parsedSolveTime();
        if (time === null || submitting || submitted) return;

        submitting = true;
        error = null;
        try {
            await submitChallengeTime(challenge.id, time);
            submitted = true;
        } catch (err) {
            error =
                err instanceof Error
                    ? err.message
                    : "Failed to submit solve time";
        } finally {
            submitting = false;
        }
    };
</script>

<div
    class="flex flex-col gap-4 p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
>
    <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Challenge Race
        </h3>
        <span
            class={[
                "text-xs font-medium px-2 py-0.5 rounded-full",
                isFinished
                    ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                    : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
            ].join(" ")}
        >
            {isFinished ? "Finished" : "Active"}
        </span>
    </div>

    <p class="text-sm text-zinc-600 dark:text-zinc-400">
        Racing against
        <span class="font-semibold text-zinc-900 dark:text-zinc-100">
            {liveChallenge.opponentUsername}
        </span>
    </p>

    {#if isFinished}
        <!-- Result display (Req 14.5) -->
        <div
            class="flex flex-col gap-2 p-3 rounded-lg bg-zinc-200 dark:bg-zinc-700"
        >
            <p class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                🏆 {winnerUsername} wins!
            </p>
            {#if marginSeconds !== null}
                <p class="text-xs text-zinc-500 dark:text-zinc-400">
                    Margin: {marginSeconds}s
                </p>
            {/if}
        </div>
    {:else if submitted}
        <!-- Waiting for opponent after submission -->
        <div
            class="flex flex-col gap-1 p-3 rounded-lg bg-zinc-200 dark:bg-zinc-700"
        >
            <p class="text-sm text-zinc-700 dark:text-zinc-300">
                Time submitted — waiting for opponent…
            </p>
        </div>
    {:else}
        <!-- Submit time form (Req 14.1) -->
        <form
            onsubmit={(e) => {
                e.preventDefault();
                handleSubmit();
            }}
            class="flex flex-col gap-2"
        >
            <label
                for="solve-time"
                class="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
                Your solve time (seconds)
            </label>
            <div class="flex gap-2">
                <input
                    id="solve-time"
                    type="number"
                    min="0"
                    max="3600"
                    step="0.1"
                    bind:value={solveTimeInput}
                    placeholder="e.g. 42.5"
                    disabled={submitting}
                    class="flex-1 px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
                    aria-describedby={error ? "race-error" : undefined}
                />
                <Button
                    type="submit"
                    disabled={!isValidTime || submitting}
                    size="sm"
                >
                    {submitting ? "Submitting…" : "Submit my time"}
                </Button>
            </div>
            {#if error}
                <p
                    id="race-error"
                    class="text-sm text-red-600 dark:text-red-400"
                    role="alert"
                >
                    {error}
                </p>
            {/if}
        </form>
    {/if}
</div>
