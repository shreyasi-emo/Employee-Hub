# Design System & Engineering Guide

The reference for building **software that belongs to the same product family**. This documents the design
system and stack conventions that every app in the family should follow, so a new product — a portal, an
admin tool, a customer app — looks and behaves like a sibling.

> **Golden rule:** reuse tokens, utility classes, and shared components. Prefer CSS tokens (`--primary`,
> `card-surface`, `btn-glass`, …) over raw hex. When something is needed by 2+ pages, extract it into a
> shared component. Consistency is the product.

---

## 1. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Language | **TypeScript** (strict) | Client + server + shared, one repo |
| Frontend | **React 18** + **Vite 7** | `client/` is the Vite root |
| Routing | **wouter** | Tiny; `<Switch>/<Route>`, `useLocation` |
| Server state | **@tanstack/react-query v5** | The *only* data-fetching layer — no ad-hoc fetch in components |
| Styling | **Tailwind CSS v3** + CSS variables | `darkMode: ["class"]` |
| Primitives | **shadcn/ui** (Radix under the hood) | Lives in `client/src/components/ui/` — treat as vendored library |
| Icons | **lucide-react** (primary), `react-icons` (fallback) | 4px icon↔label gap enforced globally |
| Forms | **react-hook-form** + **zod** (`@hookform/resolvers`) | |
| Dates | **date-fns v3** + **react-day-picker v8** | |
| Animation | **framer-motion** + `tailwindcss-animate` | |
| Charts | **recharts** | Use `--chart-1..5` tokens |
| Backend | **Express 5** + **Passport** (local) | Session-based auth, `express-session` |
| DB / ORM | **PostgreSQL** + **Drizzle ORM** + `drizzle-zod` | Schema in `shared/schema.ts` |
| Build | `tsx` (dev), `esbuild` + Vite (prod) | Single port serves API + client |

**Path aliases** (`vite.config.ts` + `tsconfig`):
`@/` → `client/src`, `@shared/` → `shared`, `@assets/` → `attached_assets`.

---

## 2. Brand identity

Keep all product/company naming in a **single source of truth** — a `client/src/lib/brand.ts` module — and
never hard-code app or company names in components. The shape:

```ts
export const BRAND = {
  APP_NAME: "…",
  COMPANY_NAME: "…",
  TAGLINE: "…",
  EMAIL_DOMAIN: "…",
  SUPPORT_EMAIL: "…",
  LOGO_INITIALS: "…",
};
```

### Brand colors

The system is intentionally **three-color**. Everything maps back to these:

| Role | Hex | Meaning |
|---|---|---|
| **Brand Blue** | `#206295` (deep) / `#1A4B94` | Primary, in-flight / pending, links |
| **Teal** | `#4BDCD9` | Accent, success / completed end-states |
| **Coral** | `#FF6F62` | Destructive, negative, urgent (this IS `destructive` and *all* `red-*`) |
| Grey | `#64748B` / `#6A7366` | Inactive / neutral |

The primary-button gradient runs deep-navy → blue → teal (`#000623 → #031887 → #36C → #4BDCD9`).

> **Important gotcha:** every Tailwind `red-*` utility is **remapped to coral** in `tailwind.config.ts`
> (`red-500` = `#FF6F62`). There is no "true red" by design. Use coral for all negative states.

---

## 3. Design tokens

All tokens live in [`client/src/index.css`](client/src/index.css) as HSL CSS variables, exposed through
`tailwind.config.ts`. The app runs **light mode only** — tokens are defined under `:root`. (A `.dark`
block exists in `index.css` but is intentionally not wired to a runtime toggle; there is no light/dark
switcher. Build for light mode.)

Use semantic Tailwind classes that read these tokens — `bg-background`, `text-foreground`, `bg-card`,
`text-muted-foreground`, `border-border`, `bg-primary`, `text-destructive`, `bg-popover`, `ring-ring`, etc.

Key token groups:

- **Surfaces:** `--background`, `--card`, `--popover`, `--sidebar` (all near-neutral `210 6% …` greys)
- **Text:** `--foreground`, `--muted-foreground`, `*-foreground` pairs
- **Brand:** `--primary` (`210 88% 42%`), `--ring`
- **Feedback:** `--destructive` (`5 100% 69%` = coral)
- **Charts:** `--chart-1..5` (blue→teal→green→amber ramp)
- **Elevation:** `--elevate-1`, `--elevate-2` (overlay tints for the hover/active system)
- **Shadows:** `--shadow-xs … --shadow-2xl` (a 2-layer "hard top + soft drop" style)
- **Status dots:** `status.{online,away,busy,offline}` (green / amber / coral / grey)

**Typography:** `--font-sans: Montserrat` (primary), `--font-serif: Georgia`, `--font-mono: Menlo`.
**Radius base:** `--radius: .5rem`, but note the system leans on **larger, explicit radii** (see §5).

---

## 4. The signature look: glassmorphism

The whole family reads as **frosted glass floating over a soft blue gradient**. This is the #1 thing that
makes an app feel like part of the family. Two ingredients:

**a) The shell background gradient** (behind everything, set on the app shell in `App.tsx`):

```
linear-gradient(188deg, #799EBB -3.37%, #D2DDE6 63.4%, #E1E8ED 72.85%, #799EBB 152.94%)
```

**b) Glass surfaces** — cards, the floating header, and secondary buttons all share one recipe:

```css
background: linear-gradient(rgba(255,255,255,.10), rgba(255,255,255,.10)), rgba(255,255,255,.50);
background-blend-mode: overlay;
backdrop-filter: blur(12px);
box-shadow: 0 0 8px rgba(44,62,98,.15),
            inset 2px 2px 2px -2px #fff, inset -2px -2px 2px -2px #fff,
            0 8px 12px rgba(0,0,0,.08);
```

You rarely write this by hand — use the utility classes below.

---

## 5. Custom utility classes (defined in `index.css`)

Prefer these over re-rolling styles.

| Class | Use |
|---|---|
| `card-surface` | The glass card surface (20px radius). Base for any panel/card. |
| `card-hover` | Adds hover lift (`translateY(-3px)`) + deeper shadow + a 6px inset blue bottom-accent. For **clickable** cards. |
| `card-press` | Alternative interactive feel: slight scale-down on press, no lift. |
| `btn-glass` | Secondary button / inactive tab glass look ("Secondary Button A"). |
| `btn-primary-gradient` | The primary blue→teal gradient fill (also drives active tabs). |
| `btn-secondary-b` | Outlined deep-blue glass ("Secondary Button B") — for in-form Add/Edit actions. |
| `segmented-toggle` | Container for List/Calendar, Card/Table segmented switches (white 1px stroke, 12px radius). |
| `tab-trigger` | Segmented tab button; `[data-state=active]` → gradient, `[data-state=inactive]` → glass. |
| `list-divider` | Thin 1px `border-border` between adjacent children (row separators). |
| `hover-elevate` / `active-elevate` / `-2` | Automatic contrast-aware overlay on hover/active (used by Button/Badge). |
| `toggle-elevate` + `toggle-elevated` | Persistent "on" background for toggles. |

**Radius language:** buttons `16px`, badges `12px`, cards/panels `20px`, icon tint-boxes `rounded-xl`,
segmented toggles `12px`. (Tailwind's `rounded-lg/md/sm` are overridden to 9/6/3px — the system mostly uses
explicit `rounded-[16px]` / `rounded-2xl` instead.)

**Scrollbars** are globally styled thin, rounded, no arrows.

---

## 6. Component conventions

### shadcn/ui primitives (`components/ui/`)
Vendored library — **keep flat and pristine**, don't hand-edit or restructure (they're CLI-regenerated).
Full set is present (button, card, dialog, select, popover, tabs, table, toast, scroll-area, calendar, …).

### Buttons — [`ui/button.tsx`](client/src/components/ui/button.tsx)

Global rules for **every** button: **16px radius**, **`min-h-10` (40px)** tall, **`gap-1` (4px)**
icon↔label spacing, `text-sm font-medium`, and an automatic contrast-aware `hover-elevate` /
`active-elevate-2` overlay. Icons are forced to 16px (`[&_svg]:size-4`).

The button hierarchy — use `variant` on `<Button>`:

| Name | `variant` | Look | When to use |
|---|---|---|---|
| **Primary** | `default` | Blue→teal gradient fill, white text (`btn-primary-gradient`) | The single main action on a view (Submit, Apply, Save, Create). |
| **Secondary A** | `secondary` *(or `outline`)* | Frosted glass, foreground text (`btn-glass`) | Standard secondary actions — the workhorse button (filters, "Leave Policy", toolbar actions). |
| **Secondary B** | `secondaryB` | Outlined deep-blue glass, blue text (`btn-secondary-b`) | In-form / in-panel actions — **Add**, **Edit**, add-row, etc. |
| **Destructive** | `destructive` | Coral fill, white text | Delete / reject / irreversible negative actions. |
| **Ghost** | `ghost` | Transparent (transparent border reserved so toggling one later doesn't shift layout) | Icon buttons, low-emphasis menu items, header controls. |

`asChild` renders the styles onto a child (e.g. an `<a>`) for links-that-look-like-buttons.

**Sizes** (`size` prop): `default` (`px-4`) · `sm` (`px-3 text-xs`) · `lg` (`px-8`) · `icon` (40×40 square).
All heights are `min-h-10`, so a button grows to fit large content rather than clipping.

> Segmented tabs reuse the same visuals: the **active** tab is the primary gradient (`tab-trigger[data-state=active]`),
> **inactive** tabs are Secondary-A glass — wrapped in a `segmented-toggle` container (see §5).

### Badges — [`ui/badge.tsx`](client/src/components/ui/badge.tsx)
**12px radius**, `text-xs font-semibold`, `px-2.5 py-0.5`, never wrap (`whitespace-nowrap`), `hover-elevate`.

| `variant` | Look | Use |
|---|---|---|
| `default` | Primary blue fill | Counts, primary tags |
| `secondary` | Neutral grey fill | Low-emphasis tags |
| `destructive` | Coral fill | Alerts, overdue counts, notification bubbles |
| `outline` | Hairline border only | Subtle categorical tags |

For **status** badges don't pick a variant — apply `statusClass(status)` to get the right tinted
`bg-[#hex]/xx text-[#hex]` (see §7). Small numeric bubbles (e.g. nav counts, unread) use `default`/`destructive`
with a fixed size like `h-4 min-w-4 px-1 text-[10px]`.

### Form fields
All text inputs share one look: **`h-10` (40px), 16px radius, `opacity-80`, `border-input`, `bg-background`,
`px-3`,** focus ring `ring-2 ring-ring`.

| Component | Import | Notes |
|---|---|---|
| `Input` | `ui/input.tsx` | Native `date`/`time`/`month` types auto-open their picker on click anywhere in the field. |
| `Textarea` | `ui/textarea.tsx` | Same field styling, multi-line. |
| `Select` | `ui/select.tsx` | Radix; `SelectTrigger` matches Input height/radius, chevron-down icon. `SelectTrigger` / `SelectValue` / `SelectContent` / `SelectItem`. |
| `Checkbox` | `ui/checkbox.tsx` | Square; use for multi-select & boolean form fields. |
| `Switch` | `ui/switch.tsx` | Toggle for on/off & mode switches (e.g. "End date", range mode). |
| `RadioGroup` | `ui/radio-group.tsx` | Single-choice sets. |
| `Label` | `ui/label.tsx` | Pair with every field. |
| `Form` | `ui/form.tsx` | react-hook-form + zod wrapper (`FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`). |
| `InputOTP` | `ui/input-otp.tsx` | One-time-code entry. |

**Standard search box** = `Input` with `pl-9` + an absolutely-positioned `Search` icon at `left-3`.

### Tabs & segmented toggles
- **`Tabs`** (`ui/tabs.tsx`) — `TabsTrigger` is styled with the `tab-trigger` class: 16px radius, `min-h-10`,
  `text-xs`; **active** = primary gradient, **inactive** = glass. `TabsList` is a flex-wrap gap-2 row.
- **Button-as-tabs** — many pages render tabs as a row of `<Button>`s (`variant={active ? "default" : "secondary"}`),
  optionally with a count `<Badge>` inside. Same visual result.
- **Segmented view toggle** (List/Calendar, Card/Table) — a `segmented-toggle` container wrapping small
  icon buttons; the active one gets the primary gradient, inactive ones `text-muted-foreground hover-elevate`.

### Overlays
| Component | Import | Use |
|---|---|---|
| `Dialog` | `ui/dialog.tsx` | Modal forms / detail dialogs. `max-w-lg`, 16px radius, `max-h-90vh` scroll, dimmed overlay, auto close-X. `DialogHeader/Title/Description/Footer`. |
| `Sheet` | `ui/sheet.tsx` | Slide-in side panel (detail views, filters). |
| `AlertDialog` | `ui/alert-dialog.tsx` | Destructive confirmations ("Are you sure?"). |
| `Popover` | `ui/popover.tsx` | Anchored floating panels (date pickers, the notification bell). |
| `DropdownMenu` | `ui/dropdown-menu.tsx` | Action/overflow menus, the user menu. |
| `HoverCard` / `Tooltip` | `ui/hover-card.tsx`, `ui/tooltip.tsx` | Hover context; `TooltipProvider` wraps the app. |
| `Command` | `ui/command.tsx` | ⌘K-style command / searchable lists (cmdk). |

### Feedback & misc
| Component | Import | Use |
|---|---|---|
| `useToast` + `Toaster` | `@/hooks/use-toast`, `ui/toaster.tsx` | All transient feedback. Success: `toast({ title })`; error: `toast({ title, description, variant: "destructive" })`. `<Toaster>` mounts once at app root. |
| `Skeleton` | `ui/skeleton.tsx` | Loading placeholders (see the loading pattern in §6). |
| `ScrollArea` | `ui/scroll-area.tsx` | **The** scroll container for lists/panels — never raw `overflow-y-auto` on content lists. |
| `Separator` | `ui/separator.tsx` | Hairline dividers; vertical variant for stat columns. |
| `Avatar` | `ui/avatar.tsx` | People; `AvatarFallback` shows hashed-color initials (see §6 avatar pattern). |
| `Progress`, `Slider`, `Accordion`, `Collapsible`, `Table`, `Tooltip`, `Toggle`, `Carousel`, `Chart`, `Breadcrumb`, `Pagination`, `Sidebar`, `Drawer`, `Menubar`, `NavigationMenu`, `Resizable`, `AspectRatio`, `ContextMenu` | `ui/*` | Full shadcn set is vendored and available. |

### Cards
Two interchangeable ways to get the glass card: the `card-surface`/`card-hover` **classes**, or a
`CARD_STYLE` inline-style object (same recipe, used where `<Card className="border-0" style={CARD_STYLE}>`
is convenient). Add `card-hover` only to **clickable** cards.

### Shared composites (reuse — don't re-roll)

| Component | Import | What / key props |
|---|---|---|
| `GlassBackButton` | `@/components/glass-back-button` | The **only** back affordance — 40×40 glass + chevron. `onClick`, `ariaLabel`, `className`. |
| `EmployeePicker` | `@/components/employee-picker` | People selector ("Add attendees" style). `employees`, `selectedIds`, `onChange`, `multiple`, `lockedIds` (can't be removed), `modal` (`true` inside a Dialog so the list wheel-scrolls). |
| `DateRangePicker` | `@/components/date-range-picker` | Date / date-range **filter** trigger (secondary/sm). `value {from,to}`, `onChange`, `align`, `triggerClassName`, `disabled` (RDP matcher). Also exports `CalCaption` (the `‹ Month ›` header). |
| `DateField` / `TimeField` | `@/components/datetime-field` | Single date + time **form fields** (full-width outline trigger + popover). `DateField`: `value: Date`, `onChange`, `disabled`, `placeholder`. `TimeField`: `value: "HH:mm"`, `onChange`, `min`/`max`, `slots`. |
| `AppSidebar` | `@/components/app-sidebar` | The role-aware left nav (see §8). |

> **Rule:** the moment a component is needed by **2+ pages**, extract it here, give it a header comment
> documenting its props, and add a row above. Page-only components stay in their page.

---

## 6b. Common patterns (build these the same way every time)

### Page header
```tsx
<div className="p-6 space-y-6 max-w-[92rem] mx-auto">
  <div className="flex items-start justify-between gap-4 flex-wrap">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Title</h1>
      <p className="text-sm text-muted-foreground">One-line subtitle</p>
    </div>
    <div className="flex items-center gap-2 flex-wrap">
      {/* secondary actions, then the one primary action */}
      <Button size="sm">Primary action</Button>
    </div>
  </div>
  {/* … */}
</div>
```

### Stat / overview card
Muted `text-sm` label · big `text-[33px] leading-tight font-bold` value · optional `text-xs` subtitle ·
a tinted **`rounded-xl` icon box** on the right (`bg-[#206295]/15 text-[#206295]` or the teal/coral tints).
Grid them `grid grid-cols-2 lg:grid-cols-4 gap-4`.

### Search + filter bar
A flex-wrap row: the standard search `Input` (`flex-1 min-w-48`), then `Select`s for each filter, then the
segmented view toggle on the right. Filtering is **client-side** over the fetched list.

### Record card (horizontal list row)
The standard clickable summary row used across list views. Anatomy, left → right:
1. **Type icon** — filled rounded tint box (`h-10/11 w-10/11 rounded-xl`), colored by domain (blue / teal / coral).
2. **Identity** (`flex-1 min-w-0`) — bold title (`text-[15px] font-bold`) + muted subtitle; inline status badges allowed.
3. **Primary divider** — `w-[1.4px] h-11 rounded-full bg-foreground/25 hidden md:block`.
4. **Labeled stat columns** — `hidden md:flex items-stretch gap-5`; each column = `icon (h-3.5 w-3.5 text-muted-foreground)`
   → `label (text-[10px] uppercase tracking-wide text-muted-foreground)` → `value (text-xs, primary datum bold)`,
   divided by vertical `<Separator orientation="vertical" className="h-11" />`. Give columns fixed widths so rows line up.
5. **Chevron** — `ChevronRight h-4 w-4 text-muted-foreground` when the card opens a detail view.

Container: `card-surface card-hover rounded-2xl px-4 py-3.5 flex items-center gap-3/4`. On narrow widths,
collapse the stat columns into a compact right-aligned summary. For time-sensitive rows add a coral ring
(`ring-1 ring-[#FF6F62]/50`) + a "Due Soon" badge.

### Avatar colors (deterministic)
Default avatars pick a brand color by hashing a seed (name/id), so a person's color is stable:
```tsx
const AVATAR_PALETTE = ["#206295", "#4BDCD9", "#FF6F62"];
function avatarColor(seed = "") {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
// <AvatarFallback style={{ backgroundColor: `${c}26`, color: c }}>{initials}</AvatarFallback>
// (`26` = ~15% alpha tint background, full-strength text.)
```

### Empty state
Centered block: a large muted icon (`h-12 w-12 text-muted-foreground/40`), an `text-lg font-semibold`
headline, and a `text-sm text-muted-foreground` hint. Wrap in `text-center py-16`.

### Loading state
Render `Skeleton` blocks in the same layout as the loaded content (e.g. a grid of card-shaped skeletons),
not a spinner.

### Multi-select + bulk actions ("Select All")
The standard selection mechanism for list pages (Employees list; reused on other list/approval pages).
Selection is a **`Set<string>` of ids** gated behind a `selectionMode` flag:

```tsx
const [selectionMode, setSelectionMode] = useState(false);
const [selected, setSelected] = useState<Set<string>>(new Set());

const toggleSel = (id: string) =>
  setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
const clearSel = () => setSelected(new Set());

// "all selected" and "select all" are computed over the *filtered* (visible) rows —
// so Select All respects the active search/filters and never touches hidden rows.
const allSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));
const toggleAll = () =>
  setSelected((s) => {
    const n = new Set(s);
    if (allSelected) filtered.forEach((e) => n.delete(e.id));
    else filtered.forEach((e) => n.add(e.id));
    return n;
  });

const exitSelection = () => { setSelectionMode(false); clearSel(); };
```

Wiring rules:
- **Enter mode:** a `Select` button (`variant="secondary"`, `MousePointerClick` icon) sets `selectionMode = true`.
  It's hidden while in selection mode.
- **Selection bar** (a `border-0` Card) appears in selection mode: on the left a **Select All** button
  (`variant="outline"`, `CheckSquare` icon, `onClick={toggleAll}`) + a live `{selected.size} selected` count;
  on the right the bulk actions (**Bulk Export**, **Bulk Update**) — each `disabled={selected.size === 0}` —
  and an `X` icon button calling `exitSelection`.
- **Table header checkbox:** `<Checkbox checked={allSelected} onCheckedChange={toggleAll} />` in a `w-8` `<th>`.
- **Row checkbox:** `<Checkbox checked={selected.has(id)} onCheckedChange={() => toggleSel(id)}
  onClick={(e) => e.stopPropagation()} />` — `stopPropagation` so ticking a row doesn't fire the row's
  navigate/onClick. In card view the same checkbox appears top-left of each card, shown only when `selectionMode`.
- Bulk actions operate on `filtered.filter((e) => selected.has(e.id))` (or `[...selected]`).

Always derive "all selected" from the **currently visible/filtered** list, never the full dataset — that's
what makes Select All behave correctly under active filters.

---

## 7. Status & semantic color system

**Single source of truth:** [`client/src/lib/status.ts`](client/src/lib/status.ts) — `statusClass(s)` and
`statusLabel(s)`. Never invent per-page status colors; feed the status string through these helpers.

The language is: **Blue = pending / in-flight**, **Teal = success / completed**, **Coral = negative /
rejected**, **Grey = inactive (draft/cancelled/closed)**. Tint pattern is `bg-[#hex]/15-25 text-[#hex]`.

Role badges have their own palette in `getRoleBadgeColor()` ([`lib/auth.ts`](client/src/lib/auth.ts)).

---

## 8. App shell & layout

Defined in [`client/src/App.tsx`](client/src/App.tsx):

```
SidebarProvider
 └ AppSidebar (15rem; collapsible to 3.5rem icon rail)
 └ shell div (SHELL_BG blue gradient)
    ├ AppHeader   → floating glass bar, absolute top-3, h-14, holds sidebar toggle,
    │               notifications bell, user menu
    └ main        → overflow-y-auto, pt-[76px] to clear the floating header
```

- **Page container standard:** `p-6 space-y-6 max-w-[92rem] mx-auto`.
- **Page header standard:** `<h1 class="text-2xl font-bold text-foreground">` + `text-sm text-muted-foreground` subtitle, actions on the right (`flex items-start justify-between`).
- **Auth gate:** `ProtectedRoute` wraps every authenticated page; unauthenticated → `/login`.
- **Navigation:** role-filtered nav groups in `app-sidebar.tsx`. Add new pages there with a `roles` array.

### Roles & access
Roles are defined in `lib/auth.ts`. Use the helpers — `isAdmin`, `isManager`, `hasRole(user, ...roles)`,
and the domain-specific gates — never compare role strings inline. Labels via `getRoleLabel`.

> **Auth is temporary scaffolding** — the family is moving to Google SSO. Don't build password-dependent
> features. A dev-only role switcher (in dev builds) lets you preview any role.

---

## 9. Data layer

**Everything goes through React Query** ([`lib/queryClient.ts`](client/src/lib/queryClient.ts)).

- **Query keys ARE the URL:** `useQuery({ queryKey: ["/api/…"] })` — the default `queryFn` joins the key
  with `/` and fetches it. Nest params as extra key segments.
- **Mutations:** `apiRequest(method, url, data)` → JSON, `credentials: "include"`. On success,
  `queryClient.invalidateQueries({ queryKey: [...] })` to refetch.
- **401 handling is automatic:** `apiRequest` redirects to `/login` on 401; `getQueryFn({on401})` can
  `returnNull` (used by `useAuth`) or `throw`.
- **Defaults:** `staleTime: Infinity`, no refetch-on-focus, no retry. Opt into polling per-query with
  `refetchInterval`.
- **Errors** are normalized to readable strings (including Zod `fieldErrors`) and surfaced via the toast
  (`useToast` → `variant: "destructive"`).

---

## 10. Backend conventions

- Single Express app ([`server/index.ts`](server/index.ts)) serves **both API and client on one port**
  (`PORT`, default 5000). Vite middleware in dev; static serve in prod.
- Routes: [`server/routes.ts`](server/routes.ts). Data access is centralized in
  [`server/storage.ts`](server/storage.ts) (repository layer over Drizzle) — routes call storage, not the DB directly.
- **Schema is shared:** [`shared/schema.ts`](shared/schema.ts) defines Drizzle tables + `drizzle-zod`
  insert/select schemas, imported by both client and server for end-to-end types.
- Session-based auth (Passport local, `express-session`). Env: `DATABASE_URL` (required),
  `SESSION_SECRET` (set in prod), `PORT`. `npm run db:push` to sync schema.
- Background jobs: `node-cron` scheduler ([`server/scheduler.ts`](server/scheduler.ts)). Email via SendGrid.

### Scripts
```
npm run dev      # tsx server/index.ts (serves client via Vite middleware)
npm run build    # esbuild server + vite build client → dist/
npm run start    # production
npm run check    # tsc typecheck
npm run db:push  # drizzle-kit push
```
> Dev-server note: the dev script uses **plain `tsx`, not `tsx watch`** — `tsx watch` + dynamic import
> deadlocks and hangs the server. Keep it as `tsx`.

---

## 11. Cross-cutting standards (do these the same way every time)

1. **Back button** → always `<GlassBackButton>`. Never hand-roll.
2. **Scrolling** → shadcn `<ScrollArea>` for scrollable lists/panels, never raw `overflow-y-auto` on content lists.
3. **Calendar month nav** → the unified `‹ Month yyyy ›` control (`CalCaption`), not two circular buttons.
4. **Status colors** → `statusClass` / `statusLabel` only.
5. **Names/brand** → from the `BRAND` module, never literals.
6. **Roles** → auth helpers, never string compares.
7. **Colors** → tokens / the 3 brand hexes; remember `red-*` is coral.
8. **`data-testid`** on every interactive element (buttons, inputs, rows, tabs) — kebab-case, descriptive
   (e.g. `button-apply-leave`, `nav-dashboard`). This is a hard convention.
9. **Record/list rows** → follow the record-card pattern (§6b).
10. **New shared component** → extract at 2+ usages, add a header comment documenting props, add a row to §6.
11. **Multi-select / bulk actions** → the `Set`-based `selectionMode` pattern in §6b; derive "all selected" from the filtered rows.

---

## 12. Project structure

```
client/src/
  components/        composites + shared components (+ components/README.md)
    ui/              shadcn/ui primitives (vendored — don't edit)
  pages/             one file per route
  lib/               brand, auth, status, utils(cn), queryClient
  hooks/             use-toast, etc.
  index.css          ← design tokens + all custom utility classes
  App.tsx            ← shell, routing, header, auth gate
shared/
  schema.ts          Drizzle tables + zod schemas (client+server share this)
server/
  index.ts routes.ts storage.ts scheduler.ts auth.ts db.ts seed.ts
tailwind.config.ts   token → utility mapping, red→coral remap, radius overrides
vite.config.ts       aliases, client root
```

---

## TL;DR for a new family app

Copy `index.css` (tokens + utilities), `tailwind.config.ts`, `lib/{utils,queryClient,status}.ts`, the
`components/ui/` set, and the shared composites. Wrap the app in `QueryClientProvider`,
apply the `SHELL_BG` gradient behind a floating glass header, build pages inside `p-6 space-y-6
max-w-[92rem] mx-auto`, and lean on `card-surface`/`card-hover`, the glass/gradient buttons, and the three
brand colors. Route data through React Query with URL-shaped query keys. Keep names in the `BRAND` module,
colors in tokens, statuses in `status.ts`, and put a `data-testid` on everything clickable.
