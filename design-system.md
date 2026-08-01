# Design System — drop-in CSS

Single source of truth for the family look: tokens, glass surfaces, the button/tab styles, the elevate
(hover/active) system, cards, and scrollbars. Copy the CSS blocks below into a global stylesheet in the
other project.

## How to use

1. Assumes a **Tailwind v3** project.
2. Put everything from §1–§6 into one global stylesheet and import it once (e.g. `import "./index.css"` at
   your entry point). The `@tailwind` directives must run once — if your app already includes them
   elsewhere, omit the three lines in §0.
3. Paste the `colors` / `fontFamily` block from §7 into your `tailwind.config` so semantic utilities
   (`bg-primary`, `text-foreground`, `bg-destructive`, `ring-ring`, `border-border`, …) exist.
4. Light mode only. (A `.dark` override is intentionally omitted — add one that mirrors `:root` if needed.)

> **The piece that breaks buttons if missing:** §6 (the elevate system) + the `--elevate-1/2` and
> `--destructive-border` tokens in §1. Every `<Button>` carries `hover-elevate active-elevate-2`; without
> those rules buttons lose their interaction states and positioning scaffolding.

---

## §0. Tailwind directives (omit if already present)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## §1. Design tokens

```css
:root {
  /* Interaction / elevation */
  --button-outline: rgba(0, 0, 0, .10);
  --badge-outline: rgba(0, 0, 0, .05);
  --opaque-button-border-intensity: -8;
  --elevate-1: rgba(0, 0, 0, .03);
  --elevate-2: rgba(0, 0, 0, .08);

  /* Surfaces */
  --background: 210 6% 98%;
  --foreground: 210 6% 12%;
  --border: 210 6% 82%;
  --scrollbar-thumb: 210 6% 72%;
  --scrollbar-thumb-hover: 210 6% 62%;

  --card: 210 6% 96%;
  --card-foreground: 210 6% 12%;
  --card-border: 210 6% 92%;

  --sidebar: 210 6% 94%;
  --sidebar-foreground: 210 6% 12%;
  --sidebar-border: 210 6% 88%;
  --sidebar-primary: 210 88% 42%;
  --sidebar-primary-foreground: 210 88% 98%;
  --sidebar-accent: 210 8% 88%;
  --sidebar-accent-foreground: 210 8% 18%;
  --sidebar-ring: 210 88% 42%;

  --popover: 210 6% 92%;
  --popover-foreground: 210 6% 12%;
  --popover-border: 210 6% 86%;

  /* Brand / semantic */
  --primary: 210 88% 42%;
  --primary-foreground: 210 88% 98%;
  --secondary: 210 6% 88%;
  --secondary-foreground: 210 6% 12%;
  --muted: 210 8% 90%;
  --muted-foreground: 210 8% 38%;
  --accent: 210 8% 92%;
  --accent-foreground: 210 8% 18%;
  --destructive: 5 100% 69%; /* #FF6F62 coral */
  --destructive-foreground: 0 0% 100%;
  --input: 210 6% 76%;
  --ring: 210 88% 42%;

  /* Charts */
  --chart-1: 210 88% 38%;
  --chart-2: 198 88% 36%;
  --chart-3: 168 76% 34%;
  --chart-4: 142 68% 32%;
  --chart-5: 28 86% 38%;

  /* Typography */
  --font-sans: Montserrat, sans-serif;
  --font-serif: Georgia, serif;
  --font-mono: Menlo, monospace;
  --tracking-normal: 0em;

  /* Geometry */
  --radius: .5rem;
  --spacing: 0.25rem;

  /* Shadows (2-layer: hard top edge + soft drop) */
  --shadow-2xs: 0px 2px 0px 0px hsl(210 6% 12% / 0.02);
  --shadow-xs: 0px 2px 0px 0px hsl(210 6% 12% / 0.04);
  --shadow-sm: 0px 2px 0px 0px hsl(210 6% 12% / 0.03), 0px 1px 2px -1px hsl(210 6% 12% / 0.06);
  --shadow: 0px 2px 0px 0px hsl(210 6% 12% / 0.04), 0px 1px 2px -1px hsl(210 6% 12% / 0.08);
  --shadow-md: 0px 2px 0px 0px hsl(210 6% 12% / 0.05), 0px 2px 4px -1px hsl(210 6% 12% / 0.10);
  --shadow-lg: 0px 2px 0px 0px hsl(210 6% 12% / 0.06), 0px 4px 6px -1px hsl(210 6% 12% / 0.12);
  --shadow-xl: 0px 2px 0px 0px hsl(210 6% 12% / 0.08), 0px 8px 10px -1px hsl(210 6% 12% / 0.16);
  --shadow-2xl: 0px 2px 0px 0px hsl(210 6% 12% / 0.20);

  /* Opaque-button border fallbacks (auto-darkened variants of each fill) */
  --sidebar-primary-border: hsl(var(--sidebar-primary));
  --sidebar-primary-border: hsl(from hsl(var(--sidebar-primary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --sidebar-accent-border: hsl(var(--sidebar-accent));
  --sidebar-accent-border: hsl(from hsl(var(--sidebar-accent)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --primary-border: hsl(var(--primary));
  --primary-border: hsl(from hsl(var(--primary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --secondary-border: hsl(var(--secondary));
  --secondary-border: hsl(from hsl(var(--secondary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --muted-border: hsl(var(--muted));
  --muted-border: hsl(from hsl(var(--muted)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --accent-border: hsl(var(--accent));
  --accent-border: hsl(from hsl(var(--accent)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --destructive-border: hsl(var(--destructive));
  --destructive-border: hsl(from hsl(var(--destructive)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
}
```

## §2. Base

```css
@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply font-sans antialiased bg-background text-foreground;
  }
}
```

## §3. Glass surfaces — cards

```css
/* Glass card surface (matches the floating header bar). */
.card-surface {
  border-radius: 20px;
  background:
    linear-gradient(rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0.10)),
    rgba(255, 255, 255, 0.50);
  background-blend-mode: overlay;
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  box-shadow:
    0 0 8px rgba(44, 62, 98, 0.15),
    inset 2px 2px 2px -2px #fff,
    inset -2px -2px 2px -2px #fff,
    0 8px 12px rgba(0, 0, 0, 0.08);
}

/* Hover: lift + deeper shadow + 6px inset blue bottom-accent. For clickable cards.
   !important overrides cards that set box-shadow via inline style. */
.card-hover {
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.card-hover:hover {
  transform: translateY(-3px);
  box-shadow:
    inset 0 -6px 0 0 #206295,
    inset 2px 2px 2px -2px #fff,
    0 0 8px rgba(44, 62, 98, 0.20),
    0 16px 26px rgba(0, 0, 0, 0.15) !important;
}

/* Pressed feel: no lift, subtle scale-down. */
.card-press {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.card-press:hover { transform: scale(0.9925); }
.card-press:active { transform: scale(0.989); }

/* Thin 1px row separators between adjacent children. */
.list-divider > * + * {
  border-top: 1px solid hsl(var(--border));
}
```

## §4. Buttons & tabs

```css
/* Secondary Button A / glass (variant="secondary" | "outline") — also inactive tabs. */
.btn-glass,
.tab-trigger[data-state="inactive"] {
  background:
    linear-gradient(rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0.10)),
    rgba(255, 255, 255, 0.50);
  background-blend-mode: overlay;
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  box-shadow:
    0 0 8px rgba(44, 62, 98, 0.15),
    inset 2px 2px 2px -2px #fff,
    inset -2px -2px 2px -2px #fff,
    0 8px 12px rgba(0, 0, 0, 0.08);
}

/* Primary button gradient (variant="default") — also active tabs. */
.btn-primary-gradient,
.tab-trigger[data-state="active"] {
  border: 1.178px solid #FFF;
  background:
    radial-gradient(70.64% 44.64% at 44.64% 100%, rgba(75, 220, 217, 0.20) 0%, rgba(160, 131, 247, 0.00) 100%),
    radial-gradient(538.12% 280.58% at -16.5% -21.71%, #000623 0%, #031887 42.92%, #36C 63.94%, #4BDCD9 100%);
  background-blend-mode: plus-lighter, normal;
  box-shadow:
    0 0 9.427px 0 rgba(255, 255, 255, 0.50) inset,
    0 0 14.14px 0 rgba(255, 255, 255, 0.20) inset,
    0 4px 29.1px 0 rgba(85, 133, 229, 0.60);
  color: #fff;
}

/* Segmented tab base: transparent border so the active border doesn't cause layout shift. */
.tab-trigger { border: 1.178px solid transparent; }

/* Segmented toggle container (List/Calendar, Card/Table, etc.). */
.segmented-toggle {
  border: 1px solid rgba(255, 255, 255, 0.70);
  border-radius: 12px;
}

/* Secondary Button B (variant="secondaryB") — outlined deep-blue glass; in-form Add/Edit actions. */
.btn-secondary-b {
  border-radius: 20px;
  border: 1.5px solid #1A4B94;
  background: rgba(26, 75, 148, 0.06);
  box-shadow: none;
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}
```

## §5. Global scrollbar — thin, rounded, no arrows

```css
* {
  scrollbar-width: thin; /* Firefox */
  scrollbar-color: hsl(var(--scrollbar-thumb)) transparent;
}
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background-color: hsl(var(--scrollbar-thumb));
  border-radius: 9999px;
  border: 2px solid transparent;
  background-clip: content-box;
}
::-webkit-scrollbar-thumb:hover { background-color: hsl(var(--scrollbar-thumb-hover)); }
::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
::-webkit-scrollbar-corner { background: transparent; }
```

## §6. Elevate system — **REQUIRED by buttons & badges**

Every `<Button>` carries `hover-elevate active-elevate-2`. Without these rules buttons have no hover/press
feedback and the relative/z-index scaffolding is missing. Contrast-aware overlay via `--elevate-1` /
`--elevate-2`.

```css
@layer utilities {
  /* Hide the ugly search cancel button in Chrome. */
  input[type="search"]::-webkit-search-cancel-button { @apply hidden; }

  /* Placeholder styling for a contentEditable div. */
  [contenteditable][data-placeholder]:empty::before {
    content: attr(data-placeholder);
    color: hsl(var(--muted-foreground));
    pointer-events: none;
  }

  /* Escape hatches: opt out of the automatic hover/active brightness. */
  .no-default-hover-elevate {}
  .no-default-active-elevate {}

  /* Toggle backgrounds sit BEHIND content; hover/active sit ON TOP so they stack. */
  .toggle-elevate::before,
  .toggle-elevate-2::before {
    content: "";
    pointer-events: none;
    position: absolute;
    inset: 0px;
    border-radius: inherit;
    z-index: -1;
  }
  .toggle-elevate.toggle-elevated::before { background-color: var(--elevate-2); }
  /* If there's a 1px border, extend the inset to cover it. */
  .border.toggle-elevate::before { inset: -1px; }

  /* Interaction overlays need a positioning context. (Breaks on overflow:hidden elements.) */
  .hover-elevate:not(.no-default-hover-elevate),
  .active-elevate:not(.no-default-active-elevate),
  .hover-elevate-2:not(.no-default-hover-elevate),
  .active-elevate-2:not(.no-default-active-elevate) {
    position: relative;
    z-index: 0;
  }

  .hover-elevate:not(.no-default-hover-elevate)::after,
  .active-elevate:not(.no-default-active-elevate)::after,
  .hover-elevate-2:not(.no-default-hover-elevate)::after,
  .active-elevate-2:not(.no-default-active-elevate)::after {
    content: "";
    pointer-events: none;
    position: absolute;
    inset: 0px;
    border-radius: inherit;
    z-index: 999;
  }

  .hover-elevate:hover:not(.no-default-hover-elevate)::after,
  .active-elevate:active:not(.no-default-active-elevate)::after {
    background-color: var(--elevate-1);
  }
  .hover-elevate-2:hover:not(.no-default-hover-elevate)::after,
  .active-elevate-2:active:not(.no-default-active-elevate)::after {
    background-color: var(--elevate-2);
  }

  /* If there's a 1px border, extend the overlay to cover it. */
  .border.hover-elevate:not(.no-hover-interaction-elevate)::after,
  .border.active-elevate:not(.no-active-interaction-elevate)::after,
  .border.hover-elevate-2:not(.no-hover-interaction-elevate)::after,
  .border.active-elevate-2:not(.no-active-interaction-elevate)::after,
  .border.hover-elevate:not(.no-hover-interaction-elevate)::after {
    inset: -1px;
  }
}
```

## §7. tailwind.config — required color mapping

Paste into `theme.extend`. Without this, semantic utilities (`bg-primary`, `text-foreground`,
`bg-destructive`, `ring-ring`, `border-border`, `bg-card`, …) won't exist and buttons/badges break.

```ts
theme: {
  extend: {
    colors: {
      background:  "hsl(var(--background) / <alpha-value>)",
      foreground:  "hsl(var(--foreground) / <alpha-value>)",
      border:      "hsl(var(--border) / <alpha-value>)",
      input:       "hsl(var(--input) / <alpha-value>)",
      ring:        "hsl(var(--ring) / <alpha-value>)",
      card:      { DEFAULT: "hsl(var(--card) / <alpha-value>)",      foreground: "hsl(var(--card-foreground) / <alpha-value>)",      border: "hsl(var(--card-border) / <alpha-value>)" },
      popover:   { DEFAULT: "hsl(var(--popover) / <alpha-value>)",   foreground: "hsl(var(--popover-foreground) / <alpha-value>)",   border: "hsl(var(--popover-border) / <alpha-value>)" },
      primary:   { DEFAULT: "hsl(var(--primary) / <alpha-value>)",   foreground: "hsl(var(--primary-foreground) / <alpha-value>)",   border: "var(--primary-border)" },
      secondary: { DEFAULT: "hsl(var(--secondary) / <alpha-value>)", foreground: "hsl(var(--secondary-foreground) / <alpha-value>)", border: "var(--secondary-border)" },
      muted:     { DEFAULT: "hsl(var(--muted) / <alpha-value>)",     foreground: "hsl(var(--muted-foreground) / <alpha-value>)",     border: "var(--muted-border)" },
      accent:    { DEFAULT: "hsl(var(--accent) / <alpha-value>)",    foreground: "hsl(var(--accent-foreground) / <alpha-value>)",    border: "var(--accent-border)" },
      destructive:{ DEFAULT:"hsl(var(--destructive) / <alpha-value>)",foreground:"hsl(var(--destructive-foreground) / <alpha-value>)",border: "var(--destructive-border)" },
      chart: {
        "1": "hsl(var(--chart-1) / <alpha-value>)",
        "2": "hsl(var(--chart-2) / <alpha-value>)",
        "3": "hsl(var(--chart-3) / <alpha-value>)",
        "4": "hsl(var(--chart-4) / <alpha-value>)",
        "5": "hsl(var(--chart-5) / <alpha-value>)",
      },
      // All reds remapped to coral so every red-* utility is coral:
      red: {
        50:"#FFF1EF",100:"#FFE2DE",200:"#FFCAC4",300:"#FFA89F",400:"#FF8B7F",
        500:"#FF6F62",600:"#F2554A",700:"#D43E33",800:"#A8312A",900:"#7E231E",950:"#4A120F",
      },
    },
    fontFamily: {
      sans: ["var(--font-sans)"],
      serif: ["var(--font-serif)"],
      mono: ["var(--font-mono)"],
    },
  },
}
```

Also required at the top level of the config:

```ts
darkMode: ["class"],
plugins: [require("tailwindcss-animate")], // + require("@tailwindcss/typography") if you use prose
```

## §8. Button variant → class map (from `button.tsx`)

For reference, how the `<Button>` variants map to the classes above:

```ts
variant: {
  default:     "btn-primary-gradient text-white",                                          // Primary
  secondary:   "btn-glass text-foreground",                                                // Secondary A
  outline:     "btn-glass text-foreground",                                                // Secondary A
  secondaryB:  "btn-secondary-b text-[#1A4B94]",                                            // Secondary B
  destructive: "bg-destructive text-destructive-foreground border border-destructive-border",
  ghost:       "border border-transparent",
},
size: {
  default: "min-h-10 px-4 py-2",
  sm:      "min-h-10 px-3 text-xs",
  lg:      "min-h-10 px-8",
  icon:    "h-10 w-10",
},
// base (all buttons): rounded-[16px] text-sm font-medium gap-1 + "hover-elevate active-elevate-2"
```
