---
name: add-svelte-component
description: Create a Svelte 5 component with optional data fetching. Use when adding UI components, views, interactive elements, or wiring client-side fetch to server endpoints.
---

# Add Svelte Component

> All code must follow the **Coding Principles** in AGENTS.md (functional, minimal, readable, modular).

## File placement
- Reusable UI component → `src/client/components/ComponentName.svelte`
- Page/view component → `src/client/views/ViewName.svelte`
- PascalCase filenames always

## Svelte 5 runes — required syntax

```svelte
<script lang="ts">
  import { onMount } from 'svelte'

  // State: $state() only — never plain let for reactive values
  let count = $state(0)
  let data = $state<MyType | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)

  // Derived: $derived() for computed values
  let doubled = $derived(count * 2)

  // Effects: $effect() for side effects
  $effect(() => {
    console.log('count changed:', count)
  })
</script>
```

## Layout and scrolling by view mode

Inline views must fit their important content within the post viewport and let users scroll the Reddit feed vertically. Keep inline interactions bounded to taps or clicks; move long content, vertical scrolling, and richer gestures into expanded mode. Expanded views may scroll when needed.

Do not intercept wheel or touch-move events across an inline view, call `preventDefault()` on feed gestures, or set `touch-action: none` / `overscroll-behavior: none` on the inline root. If gesture CSS is needed, preserve vertical feed scrolling with `touch-action: pan-y` and normal overscroll behavior. Test feed scrolling on web, Android, and iOS.

```svelte
<!-- A bounded inline layout; keep the feed's vertical gestures available. -->
<div class="h-full w-full overflow-hidden overscroll-auto touch-pan-y flex flex-col">
  <header class="flex-none"><!-- fixed height header --></header>
  <main class="flex-1 min-h-0 flex flex-col items-center justify-center">
    <!-- content -->
  </main>
  <footer class="flex-none"><!-- controls --></footer>
</div>
```

| ❌ Avoid in inline mode | ✅ Use instead |
|---|---|
| Internal scrolling for long content | Move the longer view into expanded mode |
| Broad wheel/touch interception | Bounded tap/click controls that preserve feed scrolling |
| `min-h-screen` / `h-screen` | `h-full` |
| `<style>` blocks | Tailwind classes only |
| `localStorage` | `fetch('/api/...')` |
| `fetch('https://...')` | Server proxy endpoint |
| Svelte 4 syntax (`$:`, `export let`) | Svelte 5 runes |

## Fetch on mount pattern

```svelte
<script lang="ts">
  import { onMount } from 'svelte'

  type MyData = { id: string; value: number }

  let data = $state<MyData | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)

  onMount(async () => {
    try {
      const res = await fetch('/api/my-endpoint')
      if (!res.ok) throw new Error('Failed to load data')
      const json = await res.json()
      if (json.status === 'error') throw new Error(json.message)
      data = json.data
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading = false
    }
  })
</script>

{#if loading}
  <div class="animate-pulse text-center">Loading...</div>
{:else if error}
  <div class="text-red-500 text-center">{error}</div>
{:else if data}
  <div>{data.value}</div>
{/if}
```

## Submit data pattern

```svelte
<script lang="ts">
  let submitting = $state(false)
  let error = $state<string | null>(null)

  const handleSubmit = async (payload: Record<string, unknown>): Promise<void> => {
    submitting = true
    error = null
    try {
      const res = await fetch('/api/my-endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Request failed')
      const json = await res.json()
      if (json.status === 'error') throw new Error(json.message)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      submitting = false
    }
  }
</script>
```

## Response handling

```typescript
// Server always returns one of:
// { status: 'success', data: { ... } }
// { status: 'error', message: 'Human-readable' }
// Always check json.status before accessing json.data
```

## Checklist before finishing
- [ ] Tests written FIRST for any logic extracted into `.ts` helper files
- [ ] Uses `$state()`, `$derived()`, `$effect()` — no Svelte 4 syntax
- [ ] No `<style>` blocks — Tailwind only
- [ ] No `localStorage` / `sessionStorage`
- [ ] No direct external `fetch()` — all through `/api/*`
- [ ] Inline content fits without vertical scrolling inside the post and preserves Reddit feed gestures
- [ ] Expanded layouts can scroll when their content needs more room
- [ ] Loading, error, and success states all handled in UI
- [ ] POST requests include `Content-Type: application/json` header
- [ ] `finally` block resets loading/submitting state
- [ ] Error narrowing with `instanceof Error`
- [ ] Response `status` field checked before accessing `data`
- [ ] `bun run test` passes with zero failures
