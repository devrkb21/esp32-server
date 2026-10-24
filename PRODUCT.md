# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Stack

- manager-web: migrating from Vue 2 + Element UI (vue-cli) to Vue 3 + Vite, with our own
  component kit instead of Element UI (user's decision, 2026-10-25). Vue Router 4, vue-i18n 9,
  API layer and state logic kept. Desktop-first, works on phones.
- manager-mobile: uni-app (Vue 3, Vite, TypeScript, UnoCSS, Pinia), built as an H5 web app and
  native app; wot-design-uni components are replaced by our own kit.
- Backend (unchanged): manager-api (Java), xiaozhi-server (Python, companion API), MQTT gateway.

## Users

- **Primary:** adults who keep TinyBot for themselves, a desk companion at home or at work
  (user's answer, 2026-10-25). They open the app to see what their robot is up to, set its
  alarms, reminders, prayer times and daily routine, send it messages and commands, and shape
  its look and personality.
- **Secondary:** the Nobix team operating the service from desktop: users, devices, firmware
  (OTA), model providers, parameters, knowledge base, voices.

## Product Purpose

The app is the owner's window into, and remote for, a small robot that talks, keeps them company
and lives a little day of its own on a pixel screen. Success: the owner checks in often because
it feels like visiting someone, and every setting is reachable without hunting.

## Positioning

TinyBot is a desk robot that speaks natural Bangla, has a one-bit pixel face with paws and a
daily life of its own (exercise, meals, newspaper, tea, painting, TV, books), greets you when you
come by, and remembers things about you between chats. Made in Bangladesh by Nobix Industries.

## Operating Context

- Phone first for owners (after unboxing: Wi-Fi/BLE pairing, then daily check-ins); desktop for
  the back office.
- The robot: ESP32-S3, 128x64 monochrome OLED, head and back touch pads, motion sensor, speaker
  and mic, Wi-Fi; online status, volume, firmware version, bond score, live screen preview.
- Rituals: prayer times (Bangladesh), morning greeting and evening "how was your day?",
  night mode with lullaby and night light, focus timer.

## Capabilities and Constraints

- Companion: alarms, reminders (time or interval: water, medicine, custom), prayer times with
  reminders, weather, messages to the robot (spoken, optional yes/no answer), commands (story,
  focus/pomodoro, lullaby, ring, breathe, night light, games: catch, simon, dice, reaction, demo,
  firmware update), night mode, volume, display dim/off timeouts, look editor (eye shape, size,
  spacing, height, eyes, mouth, blush, blink, energy, hands, chat font), daily routine editor,
  info pages on the robot, live OLED preview, proactive talk times, memory notes (view, delete,
  forget all), bond level and streak, events.
- Agent/role: LLM, TTS voice and speed/pitch, prompt, tools, memory mode, context providers,
  snapshots; chat history; voiceprints; device list, binding, Wi-Fi/BLE setup.
- Back office: users, params, dictionaries, providers, model config, agent templates, knowledge
  base, replacement words, voice clone, voice resources, features, server-side, OTA, address book.
- All API contracts stay as they are; this is a UI rebuild.
- Languages: Bangla is the default UI language (new locale), English second; de, pt_BR, vi,
  zh_CN, zh_TW stay available.

## Brand Commitments

- The Nobix mark (orange #F2794F to #D9532E rounded square with a cream #FFF8F3 robot face,
  #2A1B14 eyes and smile, antenna) and its orange stay (user's answer, 2026-10-25).
- Name: TinyBot (Bangla: টাইনিবট), by Nobix Industries (নোবিক্স).
- Nothing of the upstream xiaozhi look (Element UI, xiaozhi logos) is kept.

## Evidence on Hand

- `.bunshin/harvest/robot/*.jpg`, `.bunshin/harvest/robot-sheet.png`: real OLED captures of the
  face, the daily-life animations with props, Bangla subtitles, chat fonts.
- `.bunshin/harvest/brand/nobix-mark.svg`.
- A Bangla voice sample: `main/manager-mobile/src/static/voice-demos/bn-BD-NabanitaNeural.mp3`.
- No product photography of the robot body, no wordmark or brand typeface, no testimonials,
  prices, user counts or press: never fabricate them.

## Product Principles

1. Visiting, not administering: the robot's state comes first, settings second.
2. The four everyday jobs (see it, schedule it, tell it, shape it) are one tap away; everything
   else is findable without being in the way.
3. Bangla first and read easily: plain words, labels on every icon.
4. One system for owner screens and the back office, quieter where the work is dense.
5. Honest states: online/offline, delivered/pending, saved/unsaved are always visible.

## Accessibility & Inclusion

WCAG 2.2 AA contrast; touch targets at least 44 px; reduced motion honoured; Bangla text sized and
leaded for its conjuncts and vowel signs; works on low-end Android phones.
