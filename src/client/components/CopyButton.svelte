<script lang="ts">
    const FEEDBACK_DURATION_MS = 2000;

    const { onCopy }: { onCopy: () => Promise<void> } = $props();

    type ButtonState = "idle" | "copied" | "error";

    let state = $state<ButtonState>("idle");
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const resetAfterDelay = () => {
        if (timeoutId !== null) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            state = "idle";
            timeoutId = null;
        }, FEEDBACK_DURATION_MS);
    };

    const handleClick = async () => {
        if (state !== "idle") return;
        try {
            await onCopy();
            state = "copied";
        } catch {
            state = "error";
        }
        resetAfterDelay();
    };

    const label = $derived(
        state === "copied"
            ? "Copied!"
            : state === "error"
              ? "Failed to copy"
              : "Copy to Clipboard",
    );

    const variantClasses = $derived(
        state === "copied"
            ? "bg-green-600 dark:bg-green-700 text-white border-green-700 dark:border-green-500"
            : state === "error"
              ? "bg-red-600 dark:bg-red-700 text-white border-red-700 dark:border-red-500"
              : "bg-zinc-300 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border-zinc-600 dark:border-zinc-400 hover:border-zinc-700 dark:hover:border-zinc-300",
    );
</script>

<button
    type="button"
    class="inline-flex items-center justify-center whitespace-nowrap font-semibold tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-zinc-500 cursor-pointer border-2 rounded-full px-4 py-3 text-sm transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 {variantClasses}"
    onclick={handleClick}
    disabled={state !== "idle"}
    aria-live="polite"
>
    {label}
</button>
