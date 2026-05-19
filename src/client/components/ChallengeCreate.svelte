<script lang="ts">
    import { createChallenge } from "../stores/challenge";
    import { validateUsername } from "../../shared/challenge-logic";
    import Button from "./Button.svelte";

    const { puzzleId }: { puzzleId: string } = $props();

    let opponentUsername = $state("");
    let error = $state<string | null>(null);
    let success = $state(false);
    let submitting = $state(false);
    let errorTimer: ReturnType<typeof setTimeout> | null = null;

    const isValid = $derived(validateUsername(opponentUsername));

    // Show a transient error that auto-dismisses after 4 seconds (toast-like)
    const showError = (message: string) => {
        if (errorTimer !== null) clearTimeout(errorTimer);
        error = message;
        errorTimer = setTimeout(() => {
            error = null;
            errorTimer = null;
        }, 4000);
    };

    const handleSubmit = async () => {
        if (!isValid || submitting) return;
        error = null;
        success = false;
        submitting = true;
        try {
            await createChallenge(opponentUsername, puzzleId);
            opponentUsername = "";
            success = true;
            // Clear success message after 3 seconds
            setTimeout(() => {
                success = false;
            }, 3000);
        } catch (err) {
            showError(
                err instanceof Error
                    ? err.message
                    : "Failed to create challenge",
            );
        } finally {
            submitting = false;
        }
    };
</script>

<form
    onsubmit={(e) => {
        e.preventDefault();
        handleSubmit();
    }}
    class="flex flex-col gap-2"
>
    <label
        for="opponent-username"
        class="text-sm font-medium text-zinc-700 dark:text-zinc-300"
    >
        Challenge a player
    </label>
    <div class="flex gap-2">
        <input
            id="opponent-username"
            type="text"
            bind:value={opponentUsername}
            placeholder="Username"
            maxlength={20}
            autocomplete="off"
            class="flex-1 px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
            aria-describedby={error ? "challenge-error" : undefined}
            disabled={submitting}
        />
        <Button type="submit" disabled={!isValid || submitting} size="sm">
            {submitting ? "Sending…" : "Challenge"}
        </Button>
    </div>
    {#if error}
        <p
            id="challenge-error"
            class="text-sm text-red-600 dark:text-red-400 animate-in fade-in duration-200"
            role="alert"
        >
            {error}
        </p>
    {:else if success}
        <p class="text-sm text-green-600 dark:text-green-400" role="status">
            Challenge sent!
        </p>
    {:else if opponentUsername.length > 0 && !isValid}
        <p class="text-xs text-zinc-500 dark:text-zinc-400">
            Usernames can only contain letters, numbers, and underscores (max 20
            chars).
        </p>
    {/if}
</form>
