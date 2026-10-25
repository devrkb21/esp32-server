---
name: Nobix
description: The Nobix app (web and phone) for Nobix devices, first of all TinyBot, drawn as a Bangla household almanac (Panjika).
colors:
  paper: "#FBFAF7"
  paper-2: "#F3F1EC"
  ink: "#1B1714"
  ink-2: "#5A524C"
  ink-3: "#7A716A"
  rule: "#1B1714"
  rule-soft: "#DCD8D1"
  face: "#000000"
  orange: "#E8613A"
  action: "#C2451C"
  action-hover: "#A93A16"
  on-action: "#FFFFFF"
  prayer: "#0B7A4A"
  alarm: "#D4231C"
  routine: "#8F5F08"
  routine-mark: "#C98A12"
  message: "#1F4FA3"
  look: "#6B3FA0"
  ok: "#0B7A4A"
  warn: "#8F5F08"
  danger: "#B81E18"
  focus: "#1F4FA3"
  paper-dark: "#171310"
  paper-2-dark: "#221D19"
  ink-dark: "#EDE8E0"
  ink-2-dark: "#C3BAB0"
  ink-3-dark: "#A89F96"
  rule-soft-dark: "#3A332D"
  orange-dark: "#F2794F"
  action-dark: "#F2794F"
  action-hover-dark: "#F58E69"
  on-action-dark: "#171310"
  prayer-dark: "#3DBE84"
  alarm-dark: "#FF5A4E"
  routine-dark: "#E3A73A"
  message-dark: "#7BA2F0"
  look-dark: "#B293E8"
typography:
  display-date:
    fontFamily: "Libre Franklin, Anek Bangla, Hind Siliguri, system-ui, sans-serif"
    fontSize: "clamp(5.5rem, 22vw, 7.75rem)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Libre Franklin, Anek Bangla, Hind Siliguri, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 4vw, 2rem)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Libre Franklin, Anek Bangla, Hind Siliguri, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Public Sans, Hind Siliguri, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Public Sans, Hind Siliguri, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1
rounded:
  s: "6px"
  m: "10px"
  pill: "999px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "20px"
  s6: "24px"
  s8: "32px"
  s10: "40px"
  s12: "48px"
  gutter: "20px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.on-action}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.m}"
    padding: "0 6px 0 12px"
    height: "44px"
  choice-pill:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "36px"
  choice-pill-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  tag:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0 9px"
    height: "24px"
  switch-on:
    backgroundColor: "{colors.ink}"
    width: "46px"
    height: "26px"
  face-window:
    backgroundColor: "{colors.face}"
    rounded: "{rounded.s}"
  sheet:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.m}"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.m}"
---

# Design System: Nobix

Sources of truth, in this order: the tokens (`main/manager-web/src/styles/tb/tokens.css`, `main/manager-mobile/src/style/tb.scss`, same values), the two kits (`main/manager-web/src/kit/`, `main/manager-mobile/src/components/tb-*/`), the shells (`main/manager-web/src/shell/`, `main/manager-mobile/src/layouts/`), and the reference surface Today (`manager-web/src/views/today/Today.vue`, `manager-mobile/src/pages/index/index.vue`). The direction contract is `main/manager-mobile/src/.impeccable/surfaces/main-manager-mobile-src-pages-index-index-vue.md`; product truth is `PRODUCT.md`. Where this file and the code disagree, the code wins and this file is stale.

## Overview

**Creative North Star: "The Household Panjika"**

TinyBot's day is the Bangla household almanac and wall calendar: today is a giant date numeral, the day is a ruled two-ink table, and every area of the robot's life has its own ink. White newsprint, black ink, hairline and 3px rules do the structural work that cards and shadows do elsewhere. Orange appears once per screen, for the one action and for "now".

Owner screens read like visiting someone: the robot's face sits in a black window like the calendar's printed photograph, with its name plate and an honest connection word. The back office is the same world, quieter and denser: ruled tables, filter rows, sheets, orange only for the primary action and the active row.

The system deliberately refuses the category default of white rounded cards on a pastel ground with a mascot hero.

**Key Characteristics:**
- Rules, not boxes: 1px hairlines between rows, 3px ink bands under page headers, above tables, sheets and the phone tab bar.
- One ink per area from a fixed wheel; orange is never an area ink.
- Giant numerals as the hero (the date), Bangla numerals in Bangla mode.
- The robot's OLED face is the only pixel art.
- Every state is a word next to a mark, never colour alone.

### Identity

| Thing | What it is | Where it appears |
|---|---|---|
| Nobix (নোবিক্স) | The app. Window and tab title is `Nobix` (`VUE_APP_TITLE`, `VITE_APP_TITLE`); page titles read "Page · Nobix". | Sidebar brand (`nav.brand`), sign-in frame, legal page header, More page |
| NX mark | Nobix Industries' official mark (blue N, steel X). The app icon and favicon. | `manager-web/public/favicon.ico`, `apple-touch-icon.png`, `public/brand/nobix-mark.png` (sidebar 56x32, auth, legal); `manager-mobile/src/static/app/icons/*` (all app icon sizes), `static/brand/nx-mark.png` (More), `static/brand/nobix-mark.png` (auth) |
| Maker lockup | NX mark + "NOBIX INDUSTRIES" wordmark, files 640x146, a light and a dark (white wordmark) file. | Only as the maker's credit at the foot of the legal pages and the More page (`TbMaker`, web widths 120 and 140; mobile `legal-doc.vue`, `settings/index.vue`) |
| TinyBot (টাইনিবট) | One product on the platform, the first. Its mark is the orange rounded square (#F2794F to #D9532E) with a cream #FFF8F3 robot face, #2A1B14 eyes and smile, antenna. | Product contexts only. Inside the app TinyBot is represented by its live face (`TbFace`), name plate and product name, not by app chrome |

Logo rules (from `TbMaker.vue` and `AppShell.vue`):
- **Do** use the official files as they are: never recolour, stretch, crop or redraw the NX mark or the lockup.
- **Do** swap the lockup to `nobix-lockup-dark.png` under the dark theme (`[data-theme=dark]` on web, `.is-dark` on the phone).
- **Do** keep the lockup at the foot of a page (legal, More), never in a header. The header carries the NX mark and the word Nobix.
- **Do** give decorative marks `alt=""` / `aria-hidden` when the name is written next to them; a lockup on its own carries `alt="Nobix Industries"` (or `t('brand.nobix')`, `t('mauth.madeBy')`).
- **Don't** use Nobix blue anywhere outside the logo files. The blue of the UI (`message`, `focus`) is an area ink, not a brand colour.
- **Don't** put the TinyBot orange mark in app chrome, or label it "Nobix".
- **Don't** set the gradient of either mark into the UI: marks are the only gradients allowed.

### The Panjika world

Allowed (each one is used by the build): ruled tables and hairline rules as structure; giant numerals as the hero; two-ink colour coding by area; the live face window; Bangla numerals in Bangla mode; outline pills for commands; a pinned month band (`TbMonthBand sticky`).

Forbidden: paper or grain textures; cream or parchment grounds; serif italic display; drop-shadowed floating cards; gradients other than the marks; pixel body text or pixel icons; mascot illustration in headers; glassmorphism and backdrop blur; emoji as icons; eyebrows or kickers above headings; numbered section labels; three equal cards as a page structure; coloured `border-left` callouts; monospace as a costume; the em dash in copy; filler verbs (Elevate, Seamless, Unleash).

### Motion

Everything settles in 160 to 240ms with `--tb-ease` `cubic-bezier(.2,.7,.2,1)`; no bounce, no spring. Only transform and opacity animate (never width, height, top, left).

| Token | Value | Used for |
|---|---|---|
| `--tb-t-hover` | 120ms | Desktop hover on rows, links, buttons |
| `--tb-t-fast` | 160ms | Switch thumb, sheet and toast exit (with `--tb-ease-in` `cubic-bezier(.4,0,1,1)`) |
| `--tb-t-row` | 180ms | A row opening inline to edit |
| `--tb-t-sheet` | 220ms | Sheet and toast entrance (16px and 10px rise) |
| `--tb-t-day` | 240ms | The date turning (12px rise from below) |
| (fixed) | 200ms | `TbFace pulse`: one orange ring after a line is sent |
| (fixed) | 600ms linear | The now rule moving to the next minute |
| (fixed) | 900ms loop | `TbLoading`, only while a real request is open |

Reduced motion: `base.css` (web) and `tb.scss` (phone) cut every animation and transition to 0.01ms under `prefers-reduced-motion: reduce`. Do not add infinite animations except a loading state for an open request.

## Colors

Two inks on white newsprint, five area inks from a fixed wheel, and one orange.

### Primary
- **Nobix Orange, mark** (`orange`): the "now" rule in the day table, the active sidebar bar (3px), the active tab underline (2px), the face pulse ring, text selection, the link-code caret. A mark, never body text.
- **Nobix Orange, action** (`action`, hover `action-hover`, text on it `on-action`): the filled primary button and orange text ("now" time). White on it is 5.05:1. One primary action per screen.

### Area inks (one per area)
Used only for their own area's rows, tabs, icons and square marks:
- **Prayer Green** (`prayer`): prayer rows (time and title in green), Friday's date numeral.
- **Alarm Red** (`alarm`): alarms and reminders (time in red), the everyday date numeral, required-field asterisks.
- **Routine Ochre** (`routine` for text, `routine-mark` for marks): the robot's daily routine. The mark colour is too light for text.
- **Message Blue** (`message`): messages to the robot; also the "sleeping" dot on the name plate.
- **Look Violet** (`look`): the look editor.

### States
- `ok` (= prayer green), `warn` (= routine ochre), `danger` (#B81E18, deeper than alarm red), `focus` (= message blue). Always shown with a word.

### Neutral
- **Newsprint** (`paper`): the ground of every surface, sheets and the tab bar included.
- **Quiet field** (`paper-2`): table heads, hover rows, disabled inputs, insets.
- **Ink** (`ink`, 17.1:1): text, structural rules, outlines, switches, the selected choice pill.
- **Second ink** (`ink-2`, 7.3:1): secondary text, past rows, inactive tabs.
- **Third ink** (`ink-3`, 4.6:1): placeholders, struck and off states, the empty dot of offline.
- **Soft rule** (`rule-soft`): row rules inside dense tables, sheet head and foot rules, unselected pills, scrollbars.
- **OLED black** (`face`): the face window. On the phone `--tb-face-lit` #FFFFFF is a lit pixel.

### Dark mode
Ink ground, paper text, the same inks lifted for contrast (the `-dark` keys above). `rule` becomes #EDE8E0, `action` and `orange` merge into #F2794F with #171310 text on it, `ok` #3DBE84, `warn` #E3A73A, `danger` #FF5A4E, `focus` #7BA2F0. `face` stays black. Web switches on `:root[data-theme="dark"]`; the phone on `.tb-page.is-dark`. `theme-color` meta: #FBFAF7 light, #171310 dark.

### Named Rules
**The One Orange Rule.** One orange thing per screen: the primary action. The "now" rule and active-place marks are the only other orange. Switches, checks of a choice and selected pills are ink.

**The One Ink Per Area Rule.** An area ink appears only on that area's rows, tabs and marks. A page never borrows another area's ink for decoration.

**The Tokens Only Rule.** Pages use `var(--tb-*)`; no hex values in pages, no new colours.

## Typography

**Display Font:** Libre Franklin 700/800 for Latin, with Anek Bangla 700/800 for Bangla (stack `--tb-font-display`).
**Body Font:** Public Sans 400 to 700 for Latin, with Hind Siliguri 400/500/600 for Bangla (stack `--tb-font-text`).

**Character:** a newspaper and calendar grotesk (Franklin Gothic lineage) over Anek Bangla's flat, heavy wall-calendar figures; calm Public Sans and the most readable Bangla text face at 14 to 16px. All faces are self-hosted woff2 subsets (web `src/styles/tb/fonts.js` via @fontsource, phone `static/fonts/` with `@font-face` in `tb.scss`); no font CDN at runtime.

### Hierarchy
- **Date numeral** (800, `--tb-fs-date` clamp(5.5rem, 22vw, 7.75rem), 0.92, -0.02em): today's date on Today. Red, green on Fridays.
- **Headline** (800, clamp(24px, 4vw, 32px) on web, 26px on the phone, 1.15): `TbPageHeader` title, the page's h1.
- **Title** (700, 20px, 1.2): section titles, sheet titles, the date block weekday, the robot status word.
- **Plate / band** (700, 18px): the name plate name, the month band, empty-state titles.
- **Body** (400, 15px, line-height 1.55): all text. 1.55 is required for Bangla conjuncts and vowel signs; keep it on Bangla paragraphs. Descriptions cap at 70ch.
- **Label** (600, 14px; 13px small; 12px for tab labels, tags, group headings): buttons, field labels, pills, nav.
- **Table time** (display 700, 16px): the time column of the day table.

Scale tokens (web): 12, 13, 14, 15, 16, 18, 20, 24, 32, 48px (`--tb-fs-*`). Headings use `text-wrap: balance`.

### Numerals
- Bangla digits in Bangla mode, Western digits in English mode: always through `digits(n, lang)` and `timeText('HH:MM', lang, twelve)` (web `@/kit/calendar`, phone `@/utils/calendar.mjs`). Dates through `Intl` with `bn-BD`.
- Bangla mode shows times as 12-hour without am/pm (`twelve = lang === 'bn'`); the phone's day table adds a part-of-day word above the time (ভোর, সকাল).
- Tabular figures wherever numbers line up (`.tb-num`, `td`, `th`, `time`); the date numeral uses lining figures.

### Named Rules
**The Two Families Rule.** Display face for dates, numbers and headings; text face for everything else. Nothing else, no monospace.

## Layout

### Web (manager-web)
- **Shell** (`AppShell.vue`): a grid of a 248px sidebar (`--tb-sidebar`) and the main column, content capped at 1120px (`--tb-content-max`) with `clamp(16px, 4vw, 48px)` side padding.
- **Sidebar**: brand row (NX mark 32px high + Nobix, 3px ink rule under it); the chosen robot (face 96px wide or, for a device without the companion module, a 44px ruled device square; name; compact status; "switch robot"); nav groups separated by 1px ink rules with a 12px bold group heading; the account menu pinned at the foot (language, theme, password, sign out). Only the nav scrolls. Links are 38px high, ink-2, 600; the active link turns ink, gets a 3px orange bar on its left and its icon takes the area ink.
- **Under 900px** (`max-width: 899px`): the sidebar hides and a fixed bottom tab bar appears: paper ground, 3px ink rule on top, tabs 52px high with a 22px icon and a 12px label, active label underlined 2px in orange, padding `6px 4px calc(8px + env(safe-area-inset-bottom))`. Main gets `calc(96px + safe-area)` bottom padding; toasts move up to 92px.
- **Page**: `TbPageHeader` (display title, one line of purpose, actions on the right; 24px top, 16px bottom, 3px ink rule) then `TbSection` blocks (20px top, 24px bottom, 1px ink rule under each, title with a 9px square in the area ink, description, actions top right).
- **Lists** are ruled rows (`TbTable`, `TbDayTable`), never card grids. `TbTable` has a 3px ink top rule, 1px ink header rule, soft row rules, `dense` for the back office; under 640px each row becomes a labelled block and the table scrolls inside itself.
- **Edits** happen inline in a row (180ms) or in a `TbSheet`.
- Vary the arrangement with the content: a timeline, a two-column editor with a live preview (Look), a table (back office). Today on desktop: month band, then the date block, face window with name plate, and a right column (weather, "next"), then the say field, command pills and the day table.
- Width range 360 to 1440px, no horizontal page scroll.

### Phone (manager-mobile)
- Every screen renders inside `.tb-page` (the tokens live on it). Tab screens use layout `tabbar` (adds `has-tabbar`: bottom padding `calc(76px + env(safe-area-inset-bottom))`), inner screens layout `default`.
- `<view class="tb-wrap">` gives the 20px gutter (`--tb-gutter`).
- `tb-page-header` starts at `calc(env(safe-area-inset-top) + 18px)`, 26px title, 3px rule; inner screens show a 44px back target.
- **Tab bar** (`layouts/fg-tabbar`): four tabs আজ · দিন · চেহারা · আরও (Today, Day, Look, More), same drawing as the web tab bar, product-gated.
- The primary action sits in the bottom half of the screen (setup and link put a full-width primary at the foot).
- Width 320 to 480px; long Bangla wraps; nothing overflows sideways; `env(safe-area-inset-*)` respected at top (header), bottom (tab bar, sheets, toasts).

### Breakpoints
| Width | What changes |
|---|---|
| 900px | Web sidebar (at and above) or bottom tab bar (below) |
| 640px | Sheets become bottom sheets; tables turn rows into blocks; section actions drop under the title; inline fields stack |
| `pointer: coarse` | Buttons grow to 44px (small ones 40px) |

### Spacing
4px base: 4, 8, 12, 16, 20, 24, 32, 40, 48 (`--tb-s1` to `--tb-s12`), gutter 20px. Sections stack on 16px gaps inside.

## Elevation & Depth

Flat. Depth is said with rules: a 3px band says "a new thing starts here", a 1px rule separates, a soft rule separates within. The only shadow is `--tb-shadow-sheet`, for things that float above the page.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 12px 32px rgba(27,23,20,.18), 0 2px 6px rgba(27,23,20,.08)`; dark `0 12px 32px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.3)`): `TbSheet` panels, the web `TbMenu` popover, toasts.
- **Scrim**: rgba(27,23,20,.42) behind sheets.

### Named Rules
**The Rules Not Shadows Rule.** Anything that sits in the page (sections, rows, panels, the robot status) is flat and ruled. A shadow means it floats and will go away.

## Shapes

- **Pills** (999px): every button, choice pill, tag, command, tab count.
- **Medium corners** (10px, `--tb-radius-m`): inputs, selects, textareas, time fields, upload zones, sheets on desktop, menus, toasts.
- **Small corners** (6px, `--tb-radius-s`): the face window, the date block focus ring.
- **Phone sheet**: 14px top corners, square bottom.
- Local exceptions in the kit: checkbox 5px, nav links and icon buttons 8px, sidebar device square 8px.
- **Squares as marks**: area marks are square (7px in tags, 8px in the day table, 9px in section titles). Status marks are round dots (8 to 10px): filled for a state that is, an empty ring for offline and checking.
- Outlines are 1.5px ink on controls, 1px on tags and hairlines, 2px for focus.

## Components

Both kits share names, props and drawing. Web: `Tb*` registered globally (`src/kit/index.js`). Phone: `tb-*` auto-registered by easycom.

### Inventory

| Web | Phone | One line | Key props |
|---|---|---|---|
| TbButton | tb-button | Pill button: primary = the one orange action, secondary = ink outline (fills ink on hover), quiet = text, danger = red outline | variant, size s/m/l (32/40/48px web, 34/44/50px phone), icon, iconAfter, loading, disabled, block, to, href |
| TbIcon | tb-icon | The one stroke icon family (`kit/icons.js`, `utils/tbIcons.mjs`, same paths; phone draws them as a CSS mask in currentColor) | name, size (20), stroke (1.75) |
| TbField | | Label, hint or error (role=alert) around a control; wires aria-describedby | label, hint, error, required, inline |
| TbInput | tb-input | 44px field, 1.5px ink outline, focus turns the outline blue with a 3px ring | v-model, type, icon, clearable, invalid, number, size s/m/l |
| TbTextarea | | Same field, min 88px, text at least 16px | autosize, maxlength, showCount |
| TbSelect | | Native select, styled | options or groups, placeholder, size |
| TbSwitch | tb-switch | 46x26 track; on = filled ink (phone may take an area `ink`), never orange | v-model, label, disabled, loading |
| TbCheckbox | | 20px box; checked fills with `action` | v-model boolean or array, value, indeterminate |
| TbChoice | tb-choice | Segmented single choice as outline pills; selected = ink fill; arrow keys move | v-model, options, wrap |
| TbSlider | | Ink track and ring thumb, value shown | min, max, step, valueText |
| TbTime | | Native time or date input, display-face digits | type time/date, min, max |
| TbTable | | The almanac table, rows become labelled blocks under 640px | columns, rows, rowKey, dense, loading, selectable + v-model:selected, slots cell-&lt;key&gt; and empty |
| TbPagination | | Total, prev/next, rows per page, Bangla digits | page, pageSize, total, sizes |
| TbSheet | tb-sheet | Dialog: centred panel on desktop (s 420 / m 560 / l 860px), bottom sheet on phones; 3px top rule; focus trap; Esc closes | v-model:open, title, size, closeOnScrim, slot footer |
| TbTabs | | Ruled tabs; active tab gets a 3px underline in its area ink | items [{key,label,icon,ink,count}] |
| TbTag | tb-tag | 24px pill label in one ink | ink, variant line/solid, mark |
| TbSync | tb-sync | Has this reached the robot: a 22px rule plus a word | state applied/pending/off/error, text |
| TbEmpty | tb-empty | Empty and error states, optional face mood, actions slot | title, text, face |
| TbLoading | tb-loading | Three short ink rules filling in turn | label, showLabel |
| TbMenu | | Action menu popover (positioned fixed, never clipped) | items [{key,label,icon,danger,divider}], align |
| TbUpload | | Dashed drop zone and picker | v-model files, accept, multiple, text, hint |
| TbPageHeader | tb-page-header | Page h1, one line of purpose, actions (phone: optional back, sets "Title · Nobix") | title, description, back (phone) |
| TbSection | tb-section | Ruled block with the area's square mark | title, description, ink, level (phone) |
| TbFace | tb-face | The OLED in its black window: live image or a mood face | src, mood (awake, sleepy, night, offline, confused, happy), width, alt, pulse |
| TbDateBlock | tb-date-block | The giant date; swipe, arrow keys or chevrons turn the day | date, lang, extra, prevLabel, nextLabel, headingLevel |
| TbMonthBand | tb-month-band | Bangla month and year, then Gregorian month and hijri date, between a 3px and a 1px rule | date, lang, sticky |
| TbNamePlate | tb-name-plate | Name, doing-now line, days together, state dot and word | name, doing, detail, state, stateText |
| TbDayTable | tb-day-table | The day: time, square ink mark, item, state; orange now rule | rows [{time,title,note,ink,stateText,sync}], nowMinutes, nowLabel, clickable |
| TbRobotStatus | tb-robot-status | The shared connection status, compact (dot + word) or a ruled panel with why, next step and "check again" | status, compact, loading, hideOnline, hint, pollSeconds (15) |
| TbMaker | (inline in legal-doc, settings) | The maker lockup, light and dark files | width (120), align |
| TbToastHost / `toast` | tb-toast-host / `@/utils/toast` | Ink toasts at the bottom centre, max 3, 3.2s (errors 5.2s) | success, error, warning, info |
| TbConfirmHost / `confirm`, `prompt` | tb-confirm-host / `tbConfirm` | Confirm and prompt in a small sheet; `danger: true` makes the confirm button red | title, message, confirmText, cancelText, danger |
| FeatureGate (shell) | tb-not-here + `useFeatureGate` | "Not on this device" state | see Product awareness |

Rule: a new component, icon or token is a shared change to the kit, never a one-off in a page.

### Buttons
- **Shape:** pill (999px), 1.5px border, 600 weight, 14px.
- **Primary:** `action` fill, white text; hover `action-hover`. Disabled primary on web is drawn as an empty outline with `ink-3` text (orange at 45% turns brown on dark); while sending (`aria-busy`) it keeps its orange.
- **Secondary:** ink outline on paper; hover fills ink with paper text. **Quiet:** no border, `paper-2` on hover. **Danger:** `danger` outline, fills on hover.
- **Press:** 1px down. Disabled: 45% opacity.

### Commands
Outline pills with an icon and a label (story, lullaby, focus 25 minutes, game, breathe, night light) in a row that wraps on web and scrolls sideways on the phone.

### Inputs
1.5px ink outline, 10px corners, paper ground, 44px. Focus: blue outline plus `0 0 0 3px` blue at 25%. Invalid: `danger` outline with the error text under it. Disabled: 50% and `paper-2`.

### Navigation
Sidebar and tab bar as in Layout. Places are labelled words with icons, never icons alone.

### The day table (signature)
Time (display 700, 16px, 74px column), an 8px square in the area ink, the item with an optional note in ink-2 13px, the state at the right in 12px. Prayer rows print time and title in green, alarm rows print the time in red. Past rows fall back to ink-2 (the square keeps its ink). Pending rows have a dashed rule, off rows are struck in ink-3. The now row is a 2px orange rule with the time and "এখন / Now" in `action`.

### States

| State | How it is drawn |
|---|---|
| Loading | `TbLoading` (three rules) or a table's `loading` prop; only while a request is open |
| Empty | `TbEmpty` with title, one line and the next action; optionally a face mood |
| Filtered empty | Says the filter found nothing and offers to clear it |
| Error | Message in plain words plus a retry; server text goes to the console, never the screen (`friendlyError`) |
| Offline robot | Say what still works: messages and settings are kept and applied when it is back (`today.offlineNote`, `today.sentLater`) |
| Sync of a setting | `TbSync`: applied = solid green rule, pending = dashed ink-2, off = struck ink-3, error = red rule and red text, always with the word |

### Robot connection (shared)
One rule set for both apps: `manager-web/src/shell/connection.mjs` and `manager-mobile/src/utils/robotConnection.mjs` (change both together), combined by `shell/robotStatus.js` (gateway answer fresh for 20s, companion view for 25s; the sidebar re-checks every 30s while visible). A sync older than 180s (`STALE_S`) is not syncing.

| State | বাংলা | English | Mark |
|---|---|---|---|
| checking | দেখা হচ্ছে | Checking | empty ring, ink-3 |
| online | অনলাইন | Online | filled dot, `ok` |
| waiting_companion | সার্ভারে যুক্ত হচ্ছে | Joining the server | filled dot, `warn`; re-checks every 15s |
| not_syncing | সার্ভারের সাথে সংযোগ নেই | Not syncing with the server | filled dot, `warn`; shows last sync |
| offline | অফলাইন | Offline | empty ring, ink-3; shows last seen |
| server_error | সার্ভারে সমস্যা | Server problem | filled dot, `danger` (network variant of the why line) |

Each state has a label, a why line and a next step (`src/i18n/pages/status.js`, `status.ts`). The name plate adds two robot states: sleeping (`message` dot) and updating (`routine-mark` dot). The sidebar face follows the state: awake when online or checking, offline face otherwise.

### Product awareness
- Nobix devices belong to products; TinyBot is product `tinybot`, the fallback for devices from before products existed. A device without a known product key is shown as "Nobix device / নোবিক্স ডিভাইস".
- Feature keys (`KNOWN_FEATURES`, in `shell/products.js` and `utils/tbProducts.mjs`): chat, character, voiceprint, chat_history, memory, companion, day, prayer, look, screen, messages, commands, proactive, firmware, pairing_pattern.
- **Nav gating:** nav items carry `needs` (Day: day, Messages: messages, Look: look, Robot: companion, Character: character, Voiceprints: voiceprint); `visibleNav` and `visibleTabs` hide them for the chosen robot. With no robot chosen everything shows. Admin groups show to super admins only; `feature` items follow the public config switches; `ownerOnly` items hide for admins.
- **Route gating, web:** route `meta.needs`; `FeatureGate` (wraps every page in `AppShell`) shows the page header plus `TbEmpty` "এই ডিভাইসে এই সুবিধা নেই" with a primary "Today" button instead of the page, so the page never calls an API the device cannot answer.
- **Route gating, phone:** `PAGE_NEEDS` plus `const gate = useFeatureGate('<feature>')` first in `onShow` (`if (!(await gate.allowed())) return`), rendering `<tb-not-here />` when `gate.missing`.
- Products without the companion module get their status from the MQTT gateway only, and the sidebar shows a device icon instead of a face.

## Do's and Don'ts

### Do:
- **Do** start every page from `TbPageHeader` + `TbSection`, with lists as ruled rows.
- **Do** keep orange to one primary action per screen, plus the now rule and active-place marks.
- **Do** draw switches and selected pills in ink.
- **Do** put the area's ink on its rows, tabs and square marks only.
- **Do** say every state with a word next to its mark, and show whether a setting has reached the robot (`TbSync`).
- **Do** use `digits()` and `timeText()` for every number and time shown.
- **Do** check light and dark, 360 and 1440px (phone 320 to 480px).
- **Do** keep Bangla line-height at 1.55.

### Don't:
- **Don't** use hex values, new colours, or Nobix blue outside the logo.
- **Don't** use shadows on anything that sits in the page; shadows are for sheets, menus and toasts.
- **Don't** build card grids, three equal cards, coloured left-border callouts, eyebrows or numbered section labels.
- **Don't** use gradients, textures, cream grounds, blur, emoji icons or mascot illustrations.
- **Don't** draw anything pixelated except `TbFace`.
- **Don't** animate layout properties or loop an animation without an open request.
- **Don't** show raw server or infrastructure text to people.

## Copy and Voice

- **Bangla first.** Bangla (`bn`) is the default UI language, English second; the language picker offers বাংলা and English.
- **আপনি for the app.** Everything the app says to the owner: "টাইনিবটকে কিছু বলতে দিন…", "আবার দেখুন", "পাঠানো যায়নি, আবার চেষ্টা করুন".
- **তুমি for TinyBot's own lines.** What the robot says, and lines spoken to it.
- **Plain Bangladeshi Bangla.** Short sentences, everyday words, labels on every icon.
- **Keep in English** technical nouns without a common Bangla word: Wi-Fi, OTA, MAC, API, URL.
- **No em dash** (U+2014) in any copy; use a comma, a colon or a new sentence. Middle dot (·) joins facts in a line ("৯ কার্তিক · সূর্যোদয় ৬:০৫").
- **Honest and specific:** say what happened and what to do next ("পাঠানো হয়েছে, টাইনিবট অনলাইনে এলে বলবে"). Never invent facts, numbers, prices or reviews.
- **Strings:** every visible string goes through `$t` / `t()`. Reuse a key of `en.js` / `en.ts` when it says exactly the right thing; new keys go in the page's own file `src/i18n/pages/<key>.js` (web) or `.ts` (phone, `m-<key>.ts` for phone-only pages), exporting `{ bn: {...}, en: {...} }` with both languages written. Other locale tables in page files are ignored.

## Accessibility

- **Targets:** 44px minimum (`--tb-target`): inputs, time fields, switches, sliders, tab bar items (52px), back buttons, phone buttons; web buttons grow to 44px on coarse pointers (small ones 40px).
- **Focus:** always visible: 2px `focus` outline with a 2px offset (`:focus-visible`); fields add a 3px ring; menu items an inset outline. `:focus` without visible intent draws nothing.
- **Skip link:** "skip to content" to `#tb-main` on web.
- **Headings:** one h1 per page (`TbPageHeader`, or `TbDateBlock headingLevel=1` on Today), sections are h2 labelled by their title; the phone's `tb-section level` sets the exposed level.
- **ARIA:** switches are `role=switch` with `aria-checked`; choices are `radiogroup`/`radio` with roving tabindex and arrow keys; sheets are `role=dialog aria-modal` with a focus trap, Esc and focus return; toasts live in an `aria-live=polite` region, errors as `role=alert`; `TbRobotStatus` and `TbSync` are `role=status`; field errors are `role=alert` and linked by `aria-describedby`; the tab bar marks `aria-current=page`; icon-only buttons carry `aria-label`.
- **Colour:** WCAG 2.2 AA from the tokens (ink 17.1:1, ink-2 7.3:1, ink-3 4.6:1, white on action 5.05:1, area text inks 4.9 to 7.4:1). Marks (`orange`, `routine-mark`) are never text and always paired with words.
- **Language:** `<html lang>` follows the UI (`bn` / `bn-BD`, `en`) so screen readers pick the right voice.
- **Phones:** text inputs at least 16px so iOS does not zoom; safe areas respected; reduced motion honoured.

## Robot OLED Screen

The robot's screen (firmware `xiaozhi-esp32/main/boards/tinybot/`) is a 128x64 one-bit OLED. In the app it is always shown through `TbFace`: a black window, 2:1, 6% padding, 6px corners, `image-rendering: pixelated`, offline at 55% opacity.

- **Fonts:** `unscii 8` (8px a character, so at most 16 characters per 128px line) for small text; `noto_sans_basic_14` for headings; `montserrat 10` as a narrower middle line where built; `unscii 16` for the 6-digit link code. Chat subtitles use the font chosen in Look: unscii 8 (default), unscii 16, or montserrat 10/12/14.
- **Latin only on the device fonts:** text with Bangla (or any non-Latin script) letters is not drawn by the device; the face shows alone. A Bangla chat line reaches the screen only as a bitmap the server draws (at most 30px high). Setup, link, status and info pages are written in short English (Latin) words: "No Wi-Fi", "Back pad:", "Wi-Fi setup", "Link me", "Connected!".
- **Fit:** every line is written to fit 16 unscii-8 columns: the IP line drops its "IP " prefix above 13 characters, a server host is cut to 16, long Wi-Fi names end in "...".
- **QR layouts:** ECC low, version at most 3 (29 modules), 2px per module, dark modules on a lit square with a 2-module quiet zone when it fits; the square sits at the left, full height, and the text column starts 2px to its right (about 64px wide).
  - Wi-Fi setup, no phone yet: QR `WIFI:T:nopass;S:<ssid>;;`, then "Join my" / "Wi-Fi:" / the hotspot name split as "TinyBot-" over "FE99" / "or scan".
  - Wi-Fi setup, phone joined: QR of the setup URL in upper case (alphanumeric mode, a smaller code), then "Connected!" / "Now open" / 192.168.4.1 / "in a browser".
  - Link to an account: QR of the link page, "Link me", the code as "123" over "456" in unscii 16, "or enter". Without a QR the code reads "123 456" across, then "Enter this" / "code in the app".

## What the screens look like

From `.bunshin/captures/` (nobix, products, status, link, setup; round-2 is older and still shows the TinyBot orange mark as the app brand).
- **Today (web 1280):** sidebar with the NX mark and নোবিক্স; the month band ("কার্তিক ১৪৩৩" left, Gregorian and hijri right); a giant red ২৫ with রবিবার and "৯ কার্তিক · সূর্যোদয় ৬:০৫"; a vertical rule, then the black face window, টাইনিবট, the doing-now line, "২১২ দিন একসাথে" and a green "অনলাইন"; a right column with weather and "এরপর"; the say field with its button; command pills; আজকের দিন as the ruled day table with the orange now rule.
- **Today (phone 390):** the same stack in one column, commands scrolling sideways, the four-tab bar under a 3px rule; dark mode turns the ground near-black with a coral date.
- **Day (web):** the day table on the left, the live OLED (newspaper animation) on the right with now/next, then ruled links to Alarms, Reminders, Prayer times, Routine, Focus timer, each with its area icon.
- **Back office (OTA, Products):** header with one orange primary on the right, an info line, a search field with an outline "search" button, a dense ruled table with checkboxes and outline tags, pagination at the foot; edits in a centred sheet with a 3px top rule and Cancel / orange Save in the footer.
- **Not on this device:** the page title, a 3px rule, centred "এই ডিভাইসে এই সুবিধা নেই", one line and an orange "আজ পাতায় যান".
- **Connection waiting:** the robot page shows the ruled status panel: ochre dot, "সার্ভারে যুক্ত হচ্ছে", why, next step, "আবার দেখুন" and the auto-check line.
- **Robot setup (phone):** back arrow, title, a 3px rule, a four-step progress rule in orange and grey with "১/৪", a display question, ruled radio rows (selected in ink), a full-width orange "পরের ধাপ" at the foot.
- **Link (phone):** NX brand row, the face window beside "কোন চরিত্রে চলবে?", product name and MAC tail, a six-cell code field split 3 + 3 in display digits, ruled radio rows of characters, a full-width orange "যুক্ত করুন".

## Checklists

### Add a new page
1. Route: web `src/router/index.js` with `meta.title` (an i18n key), `meta.needs` if it belongs to a product feature, `meta.admin` for the back office; phone `pages.config.ts` / the page's `<route>` block (layout `tabbar` or `default`). Routes are shared changes.
2. Nav: add it to `NAV` in `shell/nav.js` (group, icon from `icons.js`, `ink` if it is an area, `needs`, `feature`, `ownerOnly`); on the phone add `PAGE_NEEDS` and call `useFeatureGate` first in `onShow`.
3. Structure: `TbPageHeader` (title, one line of purpose, actions), then `TbSection` blocks; phone inside `tb-wrap` with `tb-page-header` (`back` on inner screens).
4. Data as ruled rows (`TbTable`, `TbDayTable`), edits inline or in `TbSheet`, destructive actions through `confirm(..., { danger: true })` / `tbConfirm`.
5. States: loading, empty, filtered empty, error with retry, offline robot, no robot chosen (`TbEmpty` with a button to `/robots` or `/pages/robots/index`), plus `TbRobotStatus` where the robot's state matters.
6. Strings in `src/i18n/pages/<key>.js|ts`, bn and en both written, আপনি voice, no em dash; numbers through `digits()` / `timeText()`.
7. Demo fixtures for every call in `src/apis/demo/pages/<key>.js` (web) or `src/api/demo/pages/<key>.ts` (phone, scoped with `onPage`), generic sample names only.
8. Check: tokens only, one orange, light and dark, 360/390/1280px, 44px targets, keyboard and focus, reduced motion.

### Add a new product
1. Create it in the back office Products page (`/product-management`): key, order, Bangla and English names, description, icon URL, board types (comma patterns such as `tinybot,tinybot-*`), features.
2. Pick features from `KNOWN_FEATURES`. A new feature key goes into both `shell/products.js` and `utils/tbProducts.mjs`, with `needs` on its nav items and routes and a `useFeatureGate` call on its phone page.
3. If the product has no `companion` feature, nothing more is needed for status: it reads online/offline from the gateway and shows the device icon instead of a face.
4. Names come from the server; add a fallback to `FALLBACK_NAMES` only if devices may arrive before the product list.
5. Product marks belong to product contexts (product rows, the robot list), never to the app chrome, which stays Nobix with the NX mark.
6. Check the generic-device captures: hidden tabs, the "not on this device" page, a sidebar without a face.
