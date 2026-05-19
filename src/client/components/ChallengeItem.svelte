<script lang="ts">
    import { acceptChallenge } from "../stores/challenge";
    import type { ChallengeNotification } from "../../shared/viral-types";

    const { challenge }: { challenge: ChallengeNotification } = $props();

    let accepting = $state(false);
    let error = $state<string | null>(null);

    const handleAccept = async () => {
        if (accepting) return;
        accepting = true;
        error = null;
        try {
            await acceptChallenge(challenge.challengeId);
        } catch (err) {
            error =
                err instanceof Error
                    ? err.message
                    : "Failed to accept challenge";
        } finally {
            accepting = false;
        }
    };
</script>

<div
    class="flex items-center justify-between gap-3 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
>
    <div class="flex flex-col gap-0.5 min-w-0">
        <p
            class="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate"
        >
            {challenge.challengerUsername} challenged you
        </p>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 truncate">
            Puzzle: {challenge.puzzleId}
        </p>
        {#if error}
            <p class="text-xs text-red-600 dark:text-red-400" role="alert">
                {error}
            </p>
        {/if}
    </div>
    <button
        onclick={handleAccept}
        disabled={accepting}
        class="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 dark:bg-zinc-200 text-zinc-100 dark:text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
    >
        {accepting ? "Accepting..." : "Accept"}
    </button>
</div>
