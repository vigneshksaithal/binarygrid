<script lang="ts">
    type Solver = {
        userId: string;
        username: string;
        avatarUrl: string | null;
    };

    type Props = {
        solvers: Solver[];
    };

    let { solvers }: Props = $props();

    // Palette of background colors for initials fallback avatars
    const AVATAR_COLORS = [
        "bg-violet-500",
        "bg-blue-500",
        "bg-emerald-500",
        "bg-amber-500",
        "bg-rose-500",
        "bg-cyan-500",
        "bg-fuchsia-500",
        "bg-orange-500",
    ] as const;

    // Hash userId to a stable color from the palette
    const getAvatarColor = (userId: string): string => {
        let hash = 0;
        for (const char of userId) {
            hash = (hash * 31 + char.charCodeAt(0)) & 0xffff;
        }
        return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
    };

    const getInitial = (username: string): string =>
        username.charAt(0).toUpperCase();

    // Guard: render at most 5 avatars even if the server sends more
    const MAX_AVATARS = 5;
    const displaySolvers = $derived(solvers.slice(0, MAX_AVATARS));
</script>

<div class="flex -space-x-2" role="list" aria-label="Recent solvers">
    {#each displaySolvers as solver (solver.userId)}
        <div
            class="size-8 rounded-full border-2 border-white dark:border-zinc-900 overflow-hidden flex items-center justify-center text-xs font-semibold text-white shrink-0 {solver.avatarUrl
                ? ''
                : getAvatarColor(solver.userId)}"
            role="listitem"
            title={solver.username}
            aria-label={solver.username}
        >
            {#if solver.avatarUrl}
                <img
                    src={solver.avatarUrl}
                    alt={solver.username}
                    class="size-full object-cover"
                />
            {:else}
                {getInitial(solver.username)}
            {/if}
        </div>
    {/each}
</div>
