# Polkadot Brand & UI Guidelines

A comprehensive guide to the visual language, typography, colors, and components used across Polkadot products.

---

## Design Philosophy

The Polkadot design system follows an **editorial, refined aesthetic** that balances sophistication with approachability. Key principles:

- **Elegant simplicity** — Clean layouts with generous whitespace
- **Warm and human** — Soft, warm greys instead of cold neutrals
- **Editorial typography** — Serif headlines paired with clean sans-serif body text
- **Subtle motion** — Smooth, purposeful animations that enhance without distracting
- **Dark mode first-class** — Both modes are designed with equal care

---

## Typography

### Font Stack

| Purpose | Font Family | Fallbacks |
|---------|-------------|-----------|
| **Headlines** | DM Serif Display | Georgia, serif |
| **Body Text** | DM Sans | system-ui, sans-serif |
| **Code/Technical** | JetBrains Mono | Courier New, monospace |

### Type Scale

#### Display (Hero text)
```
Display 1: clamp(4rem, 8vw + 2rem, 8rem) — Line height: 1.1, Letter spacing: -0.03em
Display 2: clamp(3rem, 6vw + 1.5rem, 6rem) — Line height: 1.1, Letter spacing: -0.03em
Display 3: clamp(2.5rem, 5vw + 1rem, 5rem) — Line height: 1.15, Letter spacing: -0.02em
```

#### Headlines
```
H1: clamp(2.5rem, 4vw + 1rem, 4rem) — Line height: 1.2, Letter spacing: -0.02em
H2: clamp(2rem, 3vw + 0.75rem, 3rem) — Line height: 1.25, Letter spacing: -0.02em
H3: clamp(1.75rem, 2.5vw + 0.5rem, 2.5rem) — Line height: 1.3, Letter spacing: -0.01em
H4: clamp(1.5rem, 2vw + 0.5rem, 2rem) — Line height: 1.3, Letter spacing: -0.01em
```

#### Body Text
```
Body Large: clamp(1.125rem, 1vw + 0.5rem, 1.25rem) — Line height: 1.625
Body Base: 1rem (16px) — Line height: 1.625
Body Small: 0.875rem (14px) — Line height: 1.5
Caption: 0.813rem (13px) — Line height: 1.4
Label: 0.75rem (12px) — Line height: 1.3
```

### Typography Usage

- **Headlines (H1-H4)**: Always use `font-serif` (DM Serif Display)
- **Body text**: Use `font-sans` (DM Sans)
- **Technical content, labels, status text**: Use `font-mono` (JetBrains Mono)
- **Uppercase text**: Add `tracking-widest` for proper letter spacing

---

## Color Palette

### Warm Grey Scale

The foundation uses a warm grey palette (stone-tinted) rather than pure/cool greys.

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `grey-50` | `#fafaf9` | — | Background |
| `grey-100` | `#f5f5f4` | — | Surface secondary |
| `grey-200` | `#e7e5e4` | — | Borders |
| `grey-300` | `#d6d3d1` | — | Strong borders |
| `grey-400` | `#a8a29e` | — | Tertiary text (light) |
| `grey-500` | `#78716c` | — | Muted text |
| `grey-600` | `#57534e` | — | Secondary text (light) |
| `grey-700` | `#44403c` | — | Borders (dark) |
| `grey-800` | `#292524` | — | Surface secondary (dark) |
| `grey-900` | `#1c1917` | — | Surface (dark), Primary text (light) |
| `grey-950` | `#0f0f0f` | — | Background (dark) |

### Light Mode

```css
--color-bg: #fafaf9           /* Page background */
--color-surface: #ffffff       /* Cards, modals */
--color-surface-secondary: #f5f5f4  /* Secondary surfaces */
--color-text-primary: #1c1917  /* Headings, primary text */
--color-text-secondary: #57534e /* Body text */
--color-text-tertiary: #a8a29e /* Captions, hints */
--color-border: #e7e5e4        /* Default borders */
--color-border-strong: #d6d3d1 /* Emphasized borders */
```

### Dark Mode

```css
--color-bg: #0f0f0f            /* Page background */
--color-surface: #1c1917       /* Cards, modals */
--color-surface-secondary: #292524  /* Secondary surfaces */
--color-text-primary: #fafaf9  /* Headings, primary text */
--color-text-secondary: #a8a29e /* Body text */
--color-text-tertiary: #78716c /* Captions, hints */
--color-border: #44403c        /* Default borders */
--color-border-strong: #57534e /* Emphasized borders */
```

### Accent Color

```css
--color-accent: #ff2867        /* Primary accent (Polkadot pink) */
--color-accent-hover: #e6245d  /* Hover state */
--color-accent-active: #cc2050 /* Active/pressed state */
--color-accent-soft: rgba(255, 40, 103, 0.08)  /* Focus rings, highlights */
```

### Semantic Colors

```css
--color-success: #059669
--color-error: #dc2626
--color-warning: #d97706
```

---

## Spacing

Base unit: `4px`

| Token | Value | Usage |
|-------|-------|-------|
| `1` | 0.25rem (4px) | Micro spacing |
| `2` | 0.5rem (8px) | Tight spacing |
| `3` | 0.75rem (12px) | Default gap |
| `4` | 1rem (16px) | Standard spacing |
| `6` | 1.5rem (24px) | Section padding |
| `8` | 2rem (32px) | Card padding |
| `12` | 3rem (48px) | Section margins |
| `16` | 4rem (64px) | Large sections |
| `20` | 5rem (80px) | Page sections |
| `24` | 6rem (96px) | Hero sections |

### Layout Spacing Patterns

- **Page padding**: `px-6 md:px-12` (24px mobile, 48px desktop)
- **Section vertical padding**: `py-20` to `py-24` (80-96px)
- **Card padding**: `p-6` to `p-8` (24-32px)
- **Grid gaps**: `gap-6` to `gap-12` (24-48px)
- **Content max-width**: `max-w-5xl` (1024px) for reading, `max-w-6xl` (1152px) for layouts

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | 4px | Small elements, tags |
| `rounded` | 8px | Buttons, inputs |
| `rounded-lg` | 12px | Cards |
| `rounded-xl` | 16px | Large cards, modals |
| `rounded-2xl` | 24px | Feature cards |
| `rounded-full` | 9999px | Avatars, pills |

---

## Shadows

### Light Mode Shadows

```css
shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.04)
shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)
shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)
shadow-md: 0 8px 24px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.04)
shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.06)
```

### Focus Shadows

```css
shadow-focus: 0 0 0 4px rgba(255, 40, 103, 0.08)
shadow-focus-strong: 0 0 0 4px rgba(255, 40, 103, 0.16)
```

### Accent Shadows (for buttons)

```css
shadow-accent-sm: 0 2px 8px rgba(255, 40, 103, 0.2)
shadow-accent-md: 0 4px 16px rgba(255, 40, 103, 0.3)
```

---

## Animation & Motion

### Timing Functions

| Name | Value | Usage |
|------|-------|-------|
| `ease-premium` | `cubic-bezier(0.16, 1, 0.3, 1)` | Default for all transitions |
| `ease-spring` | `cubic-bezier(0.19, 1, 0.22, 1)` | Bouncy interactions |
| `ease-bounce` | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` | Playful elements |

### Duration Scale

```
100ms — Micro interactions (hover states)
150ms — Small transitions
200ms — Default transitions
300ms — Medium transitions
500ms — Large transitions
800ms — Hero animations
```

### Animation Patterns

**Fade Up (scroll reveal)**
```css
initial: { opacity: 0, y: 20-30 }
animate: { opacity: 1, y: 0 }
transition: { duration: 0.5-0.8, ease: [0.16, 1, 0.3, 1] }
```

**Staggered animations**
```
delay: 0.1s increments for sequential elements
```

**Hover effects**
```css
transform: translateY(-6px) scale(1.01)
transition: duration 0.3s
```

### Accessibility

Always respect user motion preferences:
```css
@media (prefers-reduced-motion: reduce) {
  animation-duration: 0.01ms !important;
  transition-duration: 0.01ms !important;
}
```

---

## Components

### Buttons

**Primary Button**
```html
<button class="inline-flex items-center gap-2 px-8 py-4
  bg-grey-900 dark:bg-grey-100
  text-white dark:text-grey-900
  rounded-xl font-medium
  hover:bg-grey-800 dark:hover:bg-grey-200
  transition-colors duration-200">
  Button Text
</button>
```

**Secondary Button**
```html
<button class="px-8 py-4
  border-2 border-grey-300 dark:border-grey-700
  text-grey-900 dark:text-grey-100
  rounded-xl font-medium
  hover:border-grey-800 dark:hover:border-grey-400
  hover:bg-grey-50 dark:hover:bg-grey-800
  transition-all duration-200">
  Button Text
</button>
```

### Cards

**Standard Card**
```html
<div class="p-6 bg-white dark:bg-grey-900
  rounded-xl border border-grey-200 dark:border-grey-800">
  <!-- Content -->
</div>
```

**Feature Card (with hover)**
```html
<div class="p-6 bg-white dark:bg-grey-900
  rounded-xl border border-grey-200 dark:border-grey-800
  shadow-sm hover:shadow-lg
  transition-shadow duration-300">
  <!-- Content -->
</div>
```

### Section Containers

**Standard Section**
```html
<section class="border-t border-grey-200 dark:border-grey-800
  bg-grey-50 dark:bg-grey-950 py-24">
  <div class="max-w-5xl mx-auto px-6 md:px-12">
    <!-- Content -->
  </div>
</section>
```

**Alternate Section (white/dark surface)**
```html
<section class="border-t border-grey-200 dark:border-grey-800
  bg-white dark:bg-grey-900 py-20">
  <div class="max-w-6xl mx-auto px-6 md:px-12">
    <!-- Content -->
  </div>
</section>
```

---

## Navigation

### Navbar
- Height: `h-16` (64px)
- Background: `bg-white/95 dark:bg-grey-950/95` with `backdrop-blur-xl`
- Border: `border-b border-grey-200 dark:border-grey-700`
- Position: `sticky top-0 z-40`

### Footer
- Background: `bg-white dark:bg-grey-900`
- Border: `border-t border-grey-200 dark:border-grey-800`
- Padding: `py-8`
- Link style: `text-xs text-grey-600 dark:text-grey-400`

---

## Hero Section Pattern

```html
<section class="relative h-[calc(100vh-4rem)] flex items-center justify-center">
  <!-- Background shader/effect (optional) -->
  <div class="absolute inset-0 pointer-events-none">
    <!-- Visual effect -->
  </div>

  <!-- Content -->
  <div class="text-center px-6 max-w-4xl mx-auto relative z-10">
    <h1 class="font-serif text-6xl md:text-7xl lg:text-8xl
      tracking-tight text-grey-900 dark:text-grey-100 mb-6">
      Headline
    </h1>
    <p class="font-sans text-xl md:text-2xl lg:text-3xl
      font-light text-grey-700 dark:text-grey-300 mb-12">
      Tagline text
    </p>
    <p class="font-mono text-sm md:text-base
      tracking-widest uppercase text-grey-500">
      Status text
    </p>
  </div>
</section>
```

---

## Text Styling Patterns

### Section Header
```html
<h2 class="font-serif text-4xl md:text-5xl text-grey-900 dark:text-grey-100 mb-6">
  Section Title
</h2>
<p class="text-xl text-grey-700 dark:text-grey-400 max-w-3xl mx-auto">
  Section description text
</p>
```

### Subsection Header
```html
<h3 class="font-serif text-2xl text-grey-900 dark:text-grey-100 mb-4">
  Subsection Title
</h3>
```

### Body Text
```html
<p class="text-grey-700 dark:text-grey-400 leading-relaxed">
  Body paragraph text with comfortable reading line-height.
</p>
```

### Feature Title (in cards)
```html
<h4 class="font-semibold text-grey-900 dark:text-grey-100 mb-2">
  Feature Title
</h4>
<p class="text-sm text-grey-600 dark:text-grey-400">
  Feature description
</p>
```

### Emphasized Inline Text
```html
<span class="font-semibold text-grey-900 dark:text-grey-100">Bold term:</span>
```

---

## Special Effects

### Grain Texture Overlay
Applied via `.grain` class — adds subtle noise texture to backgrounds.

### Glass Morphism
```css
.glass {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.glass-dark {
  background: rgba(15, 15, 15, 0.8);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
```

### Selection Color
```css
::selection {
  background: rgba(255, 40, 103, 0.12);
  color: var(--color-text-primary);
}
```

---

## Responsive Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablets |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Large desktop |
| `2xl` | 1536px | Extra large |

### Common Responsive Patterns

```html
<!-- Typography scaling -->
text-xl md:text-2xl lg:text-3xl

<!-- Padding scaling -->
px-6 md:px-12

<!-- Grid changes -->
grid md:grid-cols-2 lg:grid-cols-3

<!-- Visibility -->
hidden md:block
```

---

## Accessibility

- **Focus states**: All interactive elements use `focus:ring-4 focus:ring-accent-soft`
- **Color contrast**: All text meets WCAG AA standards
- **Motion**: Respects `prefers-reduced-motion`
- **Font sizing**: Base font is 16px to prevent iOS zoom on inputs
- **Touch targets**: Minimum 48x48px for buttons and interactive elements
