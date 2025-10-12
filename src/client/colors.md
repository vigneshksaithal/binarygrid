# Binary Grid Color System

This document explains how to use the centralized color system in the Binary Grid project.

## Overview

Colors are defined in `src/client/colors.css` for styling with Tailwind classes. Only colors actually used in the codebase are included.

## Color Palette

Currently used colors:

| Color Name | Hex Value | Usage |
|------------|-----------|-------|
| Primary Green | `#14f195` | Main brand color, text, focus rings |
| Red Accent | `#ff4d4d` | Error states, validation errors |

## Usage in Components

### Using Tailwind Classes

The preferred way to style components is with custom Tailwind classes:

```svelte
<!-- Primary green text -->
<div class="text-primary-green">Hello</div>

<!-- Error state -->
<div class="text-error border-error">Error message</div>

<!-- With hover states -->
<button class="hover-bg-primary-green-10">Hover me</button>

<!-- Using ring utilities -->
<input class="ring-primary-green focus:ring-2" />
```

### Available Utility Classes

#### Text Colors

- `text-primary-green` - Primary green (#14f195)
- `text-error` - Red accent (#ff4d4d)

#### Border Colors

- `border-error` - Red error border

#### Hover States

- `hover-bg-primary-green-10` - 10% opacity hover

#### Focus/Ring

- `ring-primary-green` - Focus ring

### Using CSS Variables in Inline Styles

For complex styles or dynamic values, use CSS variables:

```svelte
<div style="background-color: var(--color-primary-green)">
  Custom styled
</div>

<!-- With opacity using RGB values -->
<div style="background-color: rgb(var(--color-primary-green-rgb) / 0.5)">
  50% opacity
</div>
```

## CSS Custom Properties Reference

Available CSS variables:

```css
/* Primary Colors */
--color-primary-green: #14f195
--color-primary-green-rgb: 20 241 149

/* Accent Colors */
--color-accent-red: #ff4d4d
--color-accent-red-rgb: 255 77 77

/* Semantic Colors */
--color-error: var(--color-accent-red)
```

## Examples from Codebase

### Cell Component

```svelte
<button 
  class="ring-primary-green hover-bg-primary-green-10"
  class:border-error={hasError}
>
  {value}
</button>
```

### Grid Component

```svelte
<div class="text-primary-green">
  <div class="text-error">Error message</div>
</div>
```

## Best Practices

1. **Prefer Tailwind classes** over inline styles for consistency
2. **Use semantic color names** (`text-error`) instead of direct colors when possible
3. **Use RGB variables** for opacity: `rgb(var(--color-primary-green-rgb) / 0.5)`
4. **Only add colors when actually needed** - keep the system minimal
