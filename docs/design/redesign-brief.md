# Nobix Console redesign — brief for each screen group

We are redesigning manager-web (Vue 2 + Element UI) and manager-mobile (uni-app + Vue 3 +
wot-design-uni + UnoCSS) into **Nobix Console**: a completely new, Apple-quality look — calm,
warm, trustworthy — for parents and our own team. This is a full visual redesign, not a reskin:
rethink layout, hierarchy and flow of every screen you own, while keeping every feature working.

## Read first
1. `docs/design/nobix-design-system.md` — the design system (principles, tokens, components,
   layout patterns, copy, stress cases). Follow it exactly.
2. Web foundation (already done, do not edit unless told): `main/manager-web/src/styles/nobix/`
   (`tokens.scss`, `base.scss` with `nx-*` primitives, `element.scss` with Element UI restyled),
   `src/styles/global.scss`, and the new shared components `HeaderBar.vue` (glass top bar),
   `CustomButton.vue` (`default` = secondary, `confirm`/`add` = primary, `delete` = danger),
   `CustomDialog.vue`, `CustomTable.vue`, `CustomPagination.vue`, `VersionFooter.vue`.
   HeaderBar is the reference for code quality and style.
3. Mobile foundation (already done): `main/manager-mobile/src/style/nobix.scss` (tokens + `nx-*`
   primitives: `nx-page`, `nx-large-title`, `nx-group`, `nx-row`, `nx-card`, `nx-badge`, `nx-btn`,
   `nx-action-bar`, `nx-segmented`, `nx-empty`, …), `src/style/nobixTheme.ts` (wot-design theme),
   UnoCSS colours `nx-*` in `uno.config.ts` (e.g. `bg-nx-surface`, `text-nx-text-2`).
4. If the Skill tool is available to you, load the `apple-design` skill (Apple's interface
   principles) before designing and the `break-ui` skill's checklist when you test stress cases;
   `emil-design-eng` is also useful for polish details.

## Rules
- **Keep behaviour.** Every API call, prop, event, route, permission check, validation and i18n key
  must keep working. Restructure templates and rewrite styles freely; change script logic only
  where the new layout needs it (e.g. a computed for an empty state), and never remove a feature.
- **Tokens only.** No raw hex/rgb colours, radii, shadows or px font sizes in your styles — use
  `var(--nx-…)` (and the `nx-*` classes). Dark mode must work purely through the tokens. Remove
  the old look completely: gradients, blue/purple colours, decorative PNG icons and background
  images from the old design, `!important` fights, fixed heights that clip content.
- **Structure (web):** `<HeaderBar />` then `<main class="nx-page">` with an `nx-page-header`
  (title, one-line description, page actions on the right), content in cards / table card, and
  `<VersionFooter />`. Use Element UI components (they are restyled) plus `nx-*` primitives.
  Icons: Element's `el-icon-*` set only (no new icon libraries).
- **Structure (mobile):** `nx-page` + `nx-large-title`, grouped inset lists, sheets (`wd-popup`
  position bottom, rounded top) for create/edit, pinned `nx-action-bar` for the main action.
  Use wot-design-uni components (themed) and UnoCSS/`nx-*` classes; touch targets ≥ 88rpx.
- **States:** every list has loading (skeleton or Element loading in the card), empty (`nx-empty`
  with one action), and error handling (keep existing messages). Long names truncate
  (`nx-truncate`) with the full text available (tooltip / title / detail); MACs, keys, URLs use
  `nx-mono nx-break`. Must work at 360 px wide and 1600 px wide, light and dark.
- **Copy:** you may not edit the locale files (`src/i18n/*`) — other agents edit in parallel. If
  you need new strings, add them to `src/i18n/_pending/<your-group>.js` (web) or
  `src/i18n/_pending/<your-group>.ts` (mobile) as an object `{ key: { en, de, vi, pt_BR } }` using
  new keys under your area's prefix, and use `$t('<key>')` in your code with the English text as
  fallback where the i18n API allows; the lead merges them into the locales afterwards. Prefer
  existing keys. Write English copy per the design system (short, specific, sentence case).
- **Only touch your files** (listed in your task). Shared files (foundation, other groups' views,
  router, store, apis, locale files) are read-only for you. If you truly need a foundation change,
  describe it in your report instead of making it.
- **Do not** use the browser pane, start dev servers on fixed ports, run Docker, git commit, or
  install dependencies.

## Verify before you report
- Web: `npx vue-cli-service build --dest "%TEMP%\nx-build-<your-group>"` from `main/manager-web`
  must succeed (other agents build in parallel; if you hit a cache/lock error, retry once), and
  `npm test` must not get new failures (contract tests may assert on markup: update only tests
  that belong to your own files, and say so).
- Mobile: `pnpm type-check` and `pnpm lint` must show no new errors in your files (the project
  has some pre-existing ones; compare with `git stash`-free reasoning: only fix what you touched).
  Do not run `pnpm build:h5` (the lead builds once at the end).
- Re-read every file you changed for leftover hard-coded colours (`grep -nE "#[0-9a-fA-F]{3,8}|rgba?\(" <file>`
  should only match inside comments or token-free SVG data you intentionally kept).

## Report
Files changed, what each screen looks like now (2–4 lines per screen: layout, key components,
states), new i18n keys you put in `_pending`, anything you could not finish, any foundation change
you recommend, and the build/test output summary.
