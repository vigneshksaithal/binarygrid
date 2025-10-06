# Binary Grid Color System

This document explains how to use the centralized color system in the Binary Grid project.

## Overview

All colors are defined in two places:
- **CSS Custom Properties**: `src/client/colors.css` - for styling with Tailwind classes
- **TypeScript Constants**: `src/shared/colors.ts` - for programmatic access

## Color Palette

Based on `PROJECT_INFO/COLORS.json`:

| Color Name | Hex Value | Usage |
|------------|-----------|-------|
| Primary Green | `#14f195` | Main brand color, text, borders |
| Secondary Black | `#0e1411` | Background, modal backgrounds |
| Tertiary Gray | `#e6efea` | Text on dark backgrounds |
| Border Green | `#30b080` | Cell borders, component borders |
| Red Accent | `#ff4d4d` | Error states, validation errors |
| Yellow Accent | `#f5d442` | Warnings, highlights |

## Usage in Components

### Using Tailwind Classes

The preferred way to style components is with custom Tailwind classes:

```svelte
<!-- Primary green text -->
<div class="text-primary-green">Hello</div>

<!-- Secondary black background -->
<div class="bg-secondary-black">Content</div>

<!-- Border with green -->
<button class="border border-border-green">Click me</button>

<!-- Error state -->
<div class="text-error border-error">Error message</div>

<!-- With hover states -->
<button class="hover-bg-primary-green-10">Hover me</button>
<button class="hover-bg-primary-green-20">Primary Button</button>

<!-- Using shadow utilities -->
<div class="shadow-primary-green">Glowing box</div>
<div class="shadow-primary-green-lg">Large glow</div>
<div class="shadow-error">Error glow</div>

<!-- Using ring utilities -->
<input class="ring-primary-green focus:ring-2" />
```

### Available Utility Classes

#### Text Colors
- `text-primary-green` - Primary green (#14f195)
- `text-border-green` - Border green (#30b080)
- `text-tertiary-gray` - Tertiary gray (#e6efea)
- `text-error` - Red accent (#ff4d4d)
- `text-warning` - Yellow accent (#f5d442)

#### Background Colors
- `bg-primary-green` - Primary green
- `bg-secondary-black` - Secondary black
- `bg-tertiary-gray` - Tertiary gray
- `bg-modal` - Modal background
- `bg-dark` - Dark background

#### Border Colors
- `border-primary-green` - Primary green border
- `border-border-green` - Border green
- `border-error` - Red error border

#### Hover States
- `hover-bg-primary-green-10` - 10% opacity hover
- `hover-bg-primary-green-20` - 20% opacity hover

#### Shadows
- `shadow-primary-green` - Standard glow
- `shadow-primary-green-lg` - Large glow
- `shadow-error` - Error glow

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

<!-- In gradients -->
<div style="background: linear-gradient(to right, var(--color-primary-green), var(--color-border-green))">
  Gradient
</div>
```

### Programmatic Access in TypeScript

For JavaScript/TypeScript logic, import from `colors.ts`:

```typescript
import { colors, primaryGreen, getCssVar, setCssVar, cssVars } from '../../shared/colors'

// Access color values
console.log(colors.primary.green) // '#14f195'
console.log(primaryGreen) // '#14f195'

// Get current CSS variable value
const currentGreen = getCssVar(cssVars.primaryGreen)

// Dynamically change colors (e.g., for themes)
setCssVar(cssVars.primaryGreen, '#00ff00')
```

## CSS Custom Properties Reference

All available CSS variables:

```css
/* Primary Colors */
--color-primary-green: #14f195
--color-primary-green-rgb: 20 241 149

/* Secondary Colors */
--color-secondary-black: #0e1411
--color-secondary-black-rgb: 14 20 17

/* Tertiary Colors */
--color-tertiary-gray: #e6efea
--color-tertiary-gray-rgb: 230 239 234

/* Text Colors */
--color-text-white: #e6efea
--color-text-white-rgb: 230 239 234

/* Modal Colors */
--color-modal-bg: #0e1411
--color-modal-bg-rgb: 14 20 17

/* Border Colors */
--color-border-green: #30b080
--color-border-green-rgb: 48 176 128

/* Background Colors */
--color-bg-dark: #0e1411
--color-bg-dark-rgb: 14 20 17

/* Accent Colors */
--color-accent-red: #ff4d4d
--color-accent-red-rgb: 255 77 77
--color-accent-yellow: #f5d442
--color-accent-yellow-rgb: 245 212 66

/* Semantic Colors */
--color-error: var(--color-accent-red)
--color-warning: var(--color-accent-yellow)
--color-success: var(--color-primary-green)
--color-info: var(--color-border-green)
```

## Examples from Codebase

### Button Component
```svelte
<button class="border border-border-green text-primary-green hover-bg-primary-green-10">
  Click me
</button>
```

### Cell Component
```svelte
<button 
  class="border border-border-green shadow-primary-green hover-bg-primary-green-10"
  class:shadow-error={hasError}
>
  {value}
</button>
```

### Modal Component
```svelte
<div class="bg-modal border border-border-green text-tertiary-gray">
  Modal content
</div>
```

## Best Practices

1. **Prefer Tailwind classes** over inline styles for consistency
2. **Use semantic color names** (`text-error`) instead of direct colors when possible
3. **Use RGB variables** for opacity: `rgb(var(--color-primary-green-rgb) / 0.5)`
4. **Keep colors.json in sync** - it's the source of truth
5. **Document new color additions** in both CSS and TypeScript files

## Adding New Colors

1. Add to `PROJECT_INFO/COLORS.json`
2. Add CSS variables to `src/client/colors.css` in `:root`
3. Add TypeScript constants to `src/shared/colors.ts`
4. Create utility classes if needed in `colors.css`
5. Document in this README
