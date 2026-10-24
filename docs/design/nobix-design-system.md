# Nobix Console — design system

Nobix Console is the web (manager-web) and mobile (manager-mobile) admin for Nobix robots
(TinyBot first). It is used by parents at home and by our own team, on phones and laptops, in
light and dark. The feeling we want: **calm, warm, trustworthy** — a well-made home appliance,
not a developer dashboard.

This document is the single source of truth. Tokens live in code:
- Web: `main/manager-web/src/styles/nobix/` (`tokens.scss`, `base.scss`, `element.scss`) and
  `src/styles/element-variables.scss` (Element UI theme compiled with our colours).
- Mobile: `main/manager-mobile/src/style/nobix.scss` (CSS variables), `uno.config.ts` (theme
  colours) and the wot-design-uni `themeVars` in `src/layouts/*.vue`.

Never hard-code a colour, radius, shadow or font size in a view: use a token. If a token is
missing, add it here and in the token files first.

---

## 1. Principles (from Apple's design guidance, applied to us)

1. **Purpose and simplicity.** Every screen answers one question ("Which robots do I have?",
   "What will TinyBot remind us about today?"). The common path is on the first level; advanced
   settings are one level deeper (collapsed sections, "Advanced" disclosure, detail pages).
2. **Clarity through hierarchy, not decoration.** Order, spacing, weight and contrast carry the
   structure. No gradients behind text, no decorative borders, at most one accent colour per
   view region.
3. **Familiarity.** Standard patterns: top bar + page title + content on web; large title +
   grouped inset lists + bottom tab bar on mobile. Things that look the same behave the same.
4. **Response.** Feedback on press (`:active` scale 0.97 / darker fill, 100 ms), inline
   validation, optimistic toggles with rollback, skeletons instead of spinners for content.
5. **Spatial consistency.** Sheets and dialogs enter from and exit to the same edge; menus open
   from their trigger (`transform-origin` at the trigger).
6. **Forgiveness.** Destructive actions use a confirm step with the object's name in it and a
   red (danger) button; everything else is undoable or editable later. No confirm for
   non-destructive actions.
7. **Craft.** Aligned to a 4 px grid, consistent radii, real empty/error/loading states, long
   names truncate with a tooltip, numbers use tabular figures.
8. **Respect.** Works with keyboard, screen reader labels on icon buttons, 4.5:1 text contrast,
   44 px touch targets, `prefers-reduced-motion`, `prefers-reduced-transparency`,
   `prefers-color-scheme`.

---

## 2. Colour

Warm neutrals + one warm accent (Nobix Coral). Status colours are muted so they inform without
shouting.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--nx-bg` | `#F7F5F2` | `#121110` | App background |
| `--nx-surface` | `#FFFFFF` | `#1C1A18` | Cards, dialogs, tables |
| `--nx-surface-2` | `#F2EFEB` | `#252220` | Inset areas, table header, input fill, hover |
| `--nx-surface-3` | `#E9E5E0` | `#2F2B28` | Pressed, selected rows, segmented track |
| `--nx-border` | `rgba(40,30,20,0.10)` | `rgba(255,240,225,0.10)` | Hairlines, card edges |
| `--nx-border-strong` | `rgba(40,30,20,0.18)` | `rgba(255,240,225,0.18)` | Inputs, focused outlines base |
| `--nx-text` | `#1F1B17` | `#F4EFE9` | Primary text |
| `--nx-text-2` | `#5F5850` | `#B5ACA2` | Secondary text, labels |
| `--nx-text-3` | `#8E857B` | `#857C72` | Placeholder, meta, disabled |
| `--nx-accent` | `#E2603A` | `#FF7A52` | Primary buttons, active nav, links, focus |
| `--nx-accent-hover` | `#CF5330` | `#FF8E6B` | Hover/pressed accent |
| `--nx-accent-soft` | `#FCEDE7` | `rgba(255,122,82,0.14)` | Selected chips, active nav pill, highlights |
| `--nx-on-accent` | `#FFFFFF` | `#1B0F0A` | Text on accent |
| `--nx-success` | `#2E8B62` | `#4CC38A` | Online, saved, done |
| `--nx-success-soft` | `#E6F4EC` | `rgba(76,195,138,0.14)` | |
| `--nx-warning` | `#B7791F` | `#E8B04B` | Attention |
| `--nx-warning-soft` | `#FBF1DE` | `rgba(232,176,75,0.14)` | |
| `--nx-danger` | `#C8463D` | `#FF6B61` | Delete, errors, offline |
| `--nx-danger-soft` | `#FBE9E7` | `rgba(255,107,97,0.14)` | |
| `--nx-info` | `#3B6FB6` | `#78A6E8` | Neutral info |
| `--nx-info-soft` | `#E8EFF9` | `rgba(120,166,232,0.14)` | |
| `--nx-scrim` | `rgba(25,18,12,0.38)` | `rgba(0,0,0,0.55)` | Behind modal dialogs/sheets |
| `--nx-glass` | `rgba(255,255,255,0.72)` | `rgba(28,26,24,0.72)` | Top bar / tab bar material |

Rules: accent is for the one primary action per region and for "you are here"; never for large
fills. Status always pairs colour with an icon or word (never colour alone). Charts use the
accent plus `--nx-info`, `--nx-success`, `--nx-warning` in that order.

---

## 3. Typography

System font first (best legibility, Bangla fallback for our users):
`--nx-font: -apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", system-ui, Roboto, "Noto Sans Bengali", "Helvetica Neue", Arial, sans-serif;`
Monospace (MACs, keys, versions): `--nx-font-mono: ui-monospace, "SF Mono", "Cascadia Mono", Consolas, monospace;`

| Token | Size / line-height | Weight | Tracking | Use |
| --- | --- | --- | --- | --- |
| `--nx-text-display` | 32 / 38 | 700 | -0.022em | Login hero, empty-state hero |
| `--nx-text-title` | 24 / 30 | 700 | -0.018em | Page title |
| `--nx-text-headline` | 17 / 24 | 600 | -0.01em | Card / section titles |
| `--nx-text-body` | 15 / 22 | 400 | 0 | Body, inputs, table cells |
| `--nx-text-callout` | 14 / 20 | 400–500 | 0 | Secondary content, buttons |
| `--nx-text-footnote` | 13 / 18 | 400 | 0.005em | Labels, helper text |
| `--nx-text-caption` | 12 / 16 | 500 | 0.01em | Meta, badges, table headers (no uppercase) |

Numbers that change or align (stats, times, counts): `font-variant-numeric: tabular-nums`.
Mobile uses the same scale in `rpx` (×2) via the mobile tokens.

---

## 4. Space, size, shape, depth

- **Spacing scale** (`--nx-space-*`): 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Card padding 20
  (web) / 32rpx (mobile); page gutter 32 web desktop, 16 web narrow, 32rpx mobile.
- **Radii**: `--nx-radius-sm` 8 (chips, small buttons), `--nx-radius` 12 (inputs, buttons),
  `--nx-radius-lg` 16 (cards), `--nx-radius-xl` 22 (dialogs, sheets), pills 999.
- **Control heights**: 36 default, 32 small, 44 large/touch. Mobile touch targets ≥ 88rpx.
- **Shadows** (soft, warm): `--nx-shadow-1` `0 1px 2px rgba(40,25,10,.06)`;
  `--nx-shadow-2` `0 1px 2px rgba(40,25,10,.05), 0 8px 24px rgba(40,25,10,.07)`;
  `--nx-shadow-3` `0 2px 6px rgba(40,25,10,.08), 0 24px 64px rgba(40,25,10,.16)` (dialogs).
  Dark mode replaces shadows with a 1px `--nx-border` plus `--nx-surface` lift.
- **Content width**: web pages max 1200 px centred; forms max 720 px; dialogs 480 / 640 / 880.

---

## 5. Motion

- Durations: `--nx-dur-1` 120 ms (press, hover), `--nx-dur-2` 200 ms (fade, small moves),
  `--nx-dur-3` 320 ms (dialogs, sheets). Easing `--nx-ease`: `cubic-bezier(.2,.8,.2,1)`
  (ease-out); exits use `cubic-bezier(.4,0,1,1)`.
- Press: `transform: scale(.97)` on `:active`, 100 ms. Hover: background tint only.
- Dialogs: scale .96→1 + fade from centre; sheets (mobile): slide up from bottom, dismiss down.
- Menus/popovers scale from their trigger.
- Only `transform` and `opacity` animate. `prefers-reduced-motion: reduce` → cross-fade only.
- No looping animation except the "online" dot pulse (2.4 s, subtle) and skeleton shimmer.

---

## 6. Materials

- **Top bar (web) and tab bar (mobile)**: `--nx-glass` + `backdrop-filter: saturate(180%)
  blur(20px)`, hairline bottom/top border; content scrolls under it.
  `prefers-reduced-transparency` → solid `--nx-surface`.
- Never stack glass on glass. Dialogs and cards are solid surfaces.

---

## 7. Components (web names → Element UI mapping, mobile → wot-design-uni)

- **Button**: primary (accent fill), secondary (surface-2 fill, text colour), ghost (text only,
  accent), danger (danger fill for destructive confirm only; danger text for row actions).
  Icon buttons are 36×36 rounded with an `aria-label`. One primary button per region.
- **Input / select / textarea**: 36 px high, `--nx-surface-2` fill, no visible border at rest
  (transparent 1px), `--nx-border-strong` on hover, accent 1px + 3px `--nx-accent-soft` ring on
  focus. Labels above fields (13 px, `--nx-text-2`), helper text below (12 px, `--nx-text-3`),
  error text in danger below the field.
- **Card**: `--nx-surface`, radius lg, `--nx-shadow-1` + 1px border; header row = headline title
  left, actions right; 20 px padding.
- **List row / table**: 52 px rows, hairline separators, header in caption style on
  `--nx-surface-2`; row hover `--nx-surface-2`; actions on the right as ghost/icon buttons, the
  destructive one last.
- **Stat tile**: label (footnote, text-2) over value (title size, tabular), optional delta/badge.
- **Badge / tag**: pill, caption size, soft background of the status colour + status text colour.
- **Status dot**: 8 px circle; online = success (+ soft pulse), offline = text-3.
- **Switch**: accent when on; label on the left, switch on the right in list rows.
- **Segmented control**: track `--nx-surface-3`, selected segment `--nx-surface` + shadow-1.
- **Tabs**: segmented control for 2–4 peers; underline-free text tabs with accent indicator for
  more.
- **Dialog**: radius xl, shadow-3, title headline left-aligned, close icon top-right, footer
  right-aligned (secondary then primary). Scrim `--nx-scrim`.
- **Toast / message**: bottom-centre on mobile, top-centre on web; icon + one line; auto-hide 3 s.
- **Empty state**: illustration-free: a 48 px rounded icon tile in accent-soft, a headline, one
  sentence and one primary action.
- **Skeleton**: `--nx-surface-2` blocks with a gentle shimmer.

---

## 8. Layout patterns

### Web
- **Top bar** (64 px, glass, sticky): Nobix mark + "Nobix Console" left; primary navigation
  centre as text pills (active = accent-soft pill + accent text); right: theme toggle, language,
  user menu (avatar initial). Narrow widths (< 960 px): nav collapses into a menu button.
- **Page header**: title (title size) + one-line description (callout, text-2) on the left;
  page actions on the right (search, filters, primary button). 32 px below the top bar.
- **Content**: cards in a responsive grid (`repeat(auto-fill, minmax(320px, 1fr))`, gap 20) or a
  single table card. Filters live in the page header toolbar, not in separate panels.
- **Detail / config pages**: left column sections with sticky in-page navigation on wide
  screens; single column under 1100 px.

### Mobile
- **Large title header** (34rpx×2 = 68rpx title) that collapses on scroll; safe-area aware.
- **Grouped inset lists**: rounded 32rpx sections on `--nx-bg`, section headers in caption style.
- **Bottom tab bar**: glass, 2–4 items, accent for the active item, outline icons.
- **Sheets** for create/edit forms (slide up, drag handle), full pages for long forms.
- Primary action as a full-width button pinned above the safe area when a form needs submit.

---

## 9. Copy

- Short, specific, sentence case ("Add robot", "Save changes", not "Submit" or "OK").
- Name things for what they are ("Robots", "Voices", "Models"), not "Management".
- Errors say what happened and what to do ("Couldn't reach the server. Check your connection
  and try again.").
- Keep i18n keys; change wording only through the locale files.

---

## 10. Stress cases every screen must survive (break-ui)

Very long names (agent, device, user, city), unbreakable strings (emails, MACs, URLs, keys),
one-letter names, empty lists, 1 item, 1000+ items, huge numbers (1,234,567), missing optional
fields (no avatar, no version, null last-seen), Bangla text and mixed scripts, emoji, slow or
failed requests (loading and error states), narrow (360 px) and wide (1600 px) screens, dark
mode. Long text truncates with an ellipsis and a tooltip/full text on detail; nothing overflows
its card horizontally.
