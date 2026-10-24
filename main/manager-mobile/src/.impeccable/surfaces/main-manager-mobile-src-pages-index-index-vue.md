---
version: 1
slug: "main-manager-mobile-src-pages-index-index-vue"
primary_target: "main/manager-mobile/src/pages/index/index.vue"
related_targets: ["main/manager-web/src/views/home.vue","main/manager-web/src/views/CompanionManagement.vue","main/manager-mobile/src/pages/companion/index.vue"]
---

Scope: every screen of manager-mobile (phone app, primary) and manager-web (owner screens plus the
back office). Visitor mode: operate. Primary user: an adult who keeps TinyBot for themselves; jobs:
see what it is doing now, schedule (alarms, reminders, prayer, routine), tell it (messages,
commands), shape it (look, voice, character, memory).

## Direction contract

THESIS: TinyBot's day is the household almanac, the পঞ্জিকা and the Bangla wall calendar: today
is a giant date, the day is a ruled two-ink table, every area has its own ink. It refuses the
category default of white rounded cards on a pastel ground with a mascot hero.

OWN-WORLD: white newsprint ground #FBFAF7 (never cream), ink #1B1714 and a second grey ink
#5A524C. Area inks from one fixed wheel, used only for their area's rows, tabs and marks: prayer
green #0B7A4A, alarms and Fridays/holidays red #D4231C, routine ochre #C98A12, messages blue
#1F4FA3, look violet #6B3FA0. Nobix orange #E8613A is the single action and "today/now" mark, one
per screen. Hairline and 3px ink rules are the structure: bands, ruled tables, the bottom bar's
heavy top rule. Type: Anek Bangla (display: dates, numerals, headings), Hind Siliguri (Bangla UI
text), a matching Latin grotesk for English; Bangla numerals in Bangla mode. The robot's real
OLED face sits in a black window like the calendar's printed photograph. Dark mode: ink ground,
paper text, the same inks lifted for contrast.

STORY: the owner opens the app, sees today's date and TinyBot alive in its window (what it is
doing, online or not), reads the day at a glance, and acts in one tap: tell it something, start a
story or focus, fix tomorrow's alarm. They trust it because every setting shows whether it has
reached the robot.

FIRST VIEWPORT (phone, Today): month band (Bangla month and year, Gregorian and hijri dates);
left the date numeral ~124px in red with weekday and sunrise; right the black face window, the
name plate (টাইনিবট, doing-now line, days together) and the online word; then আজকের দিন, the
ruled table time | ink mark | item | state, an orange "now" rule at the current minute; the command
row of outline pills; the 'TinyBot-কে কিছু বলো' field with the orange বলো button; bottom bar আজ ·
দিন · চেহারা · আরও under a 3px ink rule. Desktop (web): the same band and date block head a left
column; a sidebar of ruled groups (Robot, Family/memory, Agent, Back office, admins only) uses the
same rules and inks; back-office pages are ruled tables at a denser step, orange only for the
primary action and the active row.

FORM: chosen form = candidate 4 of 7 (Panjika) on the ordered list in .bunshin/direction/worlds.md;
seed:8f2f24a25e280538. The picked sketch .bunshin/direction/cards/assigned.html is the composition
the build matches. Raises taken from declined challengers: sync state drawn in the rule itself
(solid applied, dashed waiting, struck off, always with its word) from the emission-line rail; the
ruled grid is the visible armature on every screen, back office included, from the Crouwel grid
specimen; TinyBot's name plate (name, days together, mood line) everywhere from the character
catalog; one ink per area from a fixed wheel from the acetate tab manual.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Interaction thesis

Everything settles in 160-240ms with ease-out cubic-bezier(.2,.7,.2,1), no bounce, no spring
overshoot. Swiping or tapping the date block turns the day like a tear-off sheet (240ms, the next
sheet slides up from under). The now rule advances each minute with a 600ms linear move. Rows open
inline to edit (180ms, transform and opacity only). Sending a line pulses the face window once
(200ms). Sheets and dialogs rise 220ms ease-out and leave 160ms ease-in. Hover on desktop: rows
darken their rule and show their actions in 120ms. Scroll: the month band stays pinned; nothing
parallaxes. prefers-reduced-motion makes every move instant except the now rule's position.

Allowed patterns: ruled tables and hairline rules as structure; giant numerals as the hero;
two-ink colour coding by area; the live face window (the only pixel art, the robot's own);
Bangla numerals in Bangla mode; outline pills for commands; a pinned month band.
Forbidden: paper or grain textures, cream or parchment grounds, serif italic display,
drop-shadowed floating cards, gradients other than the Nobix mark, pixel body text or pixel icons,
mascot illustration in headers, glassmorphism, emoji as icons.

## Type (chosen by rendered specimens, .bunshin/direction/type/*.png, 2026-10-25)

- Display (dates, numerals, headings): stack "Libre Franklin", "Anek Bangla"; Bangla digits come
  from Anek Bangla 800, whose flat heavy figures read like a wall calendar's (beat Noto Sans
  Bengali, Baloo Da 2 and Tiro Bangla on the same layout); Latin from Libre Franklin 800, the
  Franklin Gothic of newspapers and calendars (beat Archivo condensed and Inter, a reflex).
- Text (UI, tables, body): stack "Public Sans", "Hind Siliguri"; Hind Siliguri was the most
  readable Bangla text face at 14-16px, Public Sans the calmest Latin partner.
- Bangla digits in Bangla mode, Western digits in English mode, tabular figures in tables.
- Self-hosted woff2 with the Bengali and Latin subsets; no font from a CDN at runtime.
