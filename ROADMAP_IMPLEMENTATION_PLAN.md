# ESP Smart Voice Platform - Master Roadmap & Implementation Plan

> **Document Purpose**: This is the master implementation plan and progress tracker for features across the entire ESP stack:
> - **Mobile App** (`main/manager-mobile`)
> - **Web Console** (`main/manager-web`)
> - **Backend Server** (`main/manager-api` Spring Boot + MQTT Gateway)
> - **Core AI Voice Server** (`main/xiaozhi-server` Python FastAPI / WebSocket)
> - **Voiceprint Biometrics** (`main/voiceprint`)

---

## Progress Overview

| Phase | Description | Status | Progress |
|---|---|---|---|
| **Phase 1** | Device Remote Control & Telemetry (Reboot, Volume Slider, Live RSSI) | 🟢 Completed | 100% |
| **Phase 2** | TTS Voice Audition & Instant Audio Previews | 🟢 Completed | 100% |
| **Phase 3** | Dark Mode & Modern UI Themes (Mobile & Web) | 🟢 Completed | 100% |
| **Phase 4** | BLE (Bluetooth Low Energy) Fast Provisioning | 🟢 Completed | 100% |
| **Phase 5** | Smart Home & Home Assistant Voice Commands (Bengali/English) | 🟢 Completed | 100% |
| **Phase 6** | Voiceprint Security & Speaker-Restricted Actions | 🟢 Completed | 100% |
| **Phase 7** | Analytics, Latency & Token Usage Dashboard | 🟢 Completed | 100% |

---

## Phase 1: Device Remote Control & Live Telemetry

**Goal**: Allow users to monitor device health (signal strength, battery, online status) and remotely control device volume and reboot from both the mobile app and web console.

### Backend (`manager-api` & MQTT Gateway)
- [x] **1.1** Add Device Command DTO and Controller endpoints in `DeviceController.java`:
  - `POST /device/command/{deviceId}/reboot`: Send reboot command via MQTT Gateway.
  - `POST /device/command/{deviceId}/volume`: Send volume adjustment command (0-100) via MQTT Gateway.
- [x] **1.2** Add MQTT Gateway command handling for `reboot` and `set_volume` in `DeviceServiceImpl.java`.
- [x] **1.3** Store / query device telemetry and online status via `POST /device/bind/{agentId}`.

### Mobile App (`manager-mobile`)
- [x] **1.4** Update `src/pages/device/index.vue`:
  - Add Live Signal Strength & Online/Offline status pill badge.
  - Add Volume Control Slider (`<wd-slider>`) with debounce command execution.
  - Add "Reboot Device" button with confirmation popup dialog.
- [x] **1.5** Add device remote control translations in `en.ts`, `de.ts`, `pt_BR.ts`, `vi.ts`.

### Web Console (`manager-web`)
- [x] **1.6** Update `src/views/DeviceManagement.vue`:
  - Add Volume slider modal control and `Api.device.setDeviceVolume`.
  - Add "Reboot" button in table row actions with confirmation and `Api.device.rebootDevice`.
  - Display live online status tag.

---

## Phase 2: TTS Voice Audition & Instant Audio Previews

**Goal**: Allow users to click a "Play Demo" button next to any TTS voice in Agent settings (Mobile & Web) to hear how it sounds before saving.

### Backend (`manager-api` & `xiaozhi-server`)
- [x] **2.1** Expose sample audio preview API:
  - Anonymous `/voice-demos/**` endpoint via `ShiroConfig.java` and `WebMvcConfig.java`.
  - 13 Pre-cached MP3 voice demo assets across English and Bengali voices.
- [x] **2.2** Map standard preview sentences in English and Bengali (*"হ্যালো, আমি আপনার স্মার্ট ভয়েস অ্যাসিস্ট্যান্ট"* / *"Hello, I am your smart voice assistant"*).

### Mobile App (`manager-mobile`)
- [x] **2.3** Update `src/pages/agent/edit.vue`:
  - Direct audition play/pause button next to each voice in the popup list with `uni.createInnerAudioContext()`.
  - Quick audition play/pause icon directly on the main Agent Voice card row (`displayNames.voiceprint`).
  - Bundled offline/fast voice demos in `src/static/voice-demos/` via `voicePreviewUtils.mjs`.
- [x] **2.4** Add i18n keys for voice preview (`agent.playDemo`, `agent.playingDemo`, `agent.audioLoadFailed`) across `en.ts`, `de.ts`, `pt_BR.ts`, `vi.ts`.

### Web Console (`manager-web`)
- [x] **2.5** Update `src/views/roleConfig.vue` & `src/views/VoiceResourceManagement.vue`:
  - Added HTML5 Audio playback button to table row operations in `VoiceResourceManagement.vue`.
  - Voice audition play/pause in `roleConfig.vue` dropdown items with automatic `/voice-demos/{key}.mp3` fallback.

---

## Phase 3: Dark Mode & Modern UI Themes

**Goal**: Provide a native dark mode (Dark / Light / Auto) across the mobile app and web console for a premium look and comfortable nighttime use.

### Mobile App (`manager-mobile`)
- [x] **3.1** Configure theme state in Pinia (`src/store/theme.ts`) with persistence (`uni.getStorageSync`).
- [x] **3.2** Integrate Wot Design Uni dark theme config provider (`<wd-config-provider :theme="themeStore.currentTheme">`) in `default.vue` and `tabbar.vue`.
- [x] **3.3** Add Theme Selector in `src/pages/settings/index.vue` (Light / Dark / Follow System) with multi-language support (`en`, `de`, `pt_BR`, `vi`).
- [x] **3.4** Update custom CSS classes (`bg-[#f5f7fb]` -> semantic dark mode classes and variables) in `src/style/index.scss`.

### Web Console (`manager-web`)
- [x] **3.5** Add dark mode toggle in the header navigation bar (`HeaderBar.vue`), managed by `src/utils/theme.js` and styled in `src/styles/dark.scss`.

---

## Phase 4: BLE (Bluetooth Low Energy) Fast Provisioning

**Goal**: Allow users to connect ESP devices to WiFi via Bluetooth without disconnecting from mobile data or connecting to an AP hotspot manually.

### Firmware & Protocol Compatibility
- [x] **4.1** Verify BLE GATT service UUIDs for ESP32 Blufi / WiFi provisioning protocol in `bleProvisionUtils.mjs`.

### Mobile App (`manager-mobile`)
- [x] **4.2** Add Bluetooth Provisioning Option in `src/pages/device-config/index.vue`:
  - Mode selector: "WiFi Configuration", "Bluetooth (BLE) Fast Config", "Ultrasonic Configuration".
- [x] **4.3** Implement BLE scanning component in `components/ble-config.vue` using `openBluetoothAdapter` and `startBleDiscovery`.
- [x] **4.4** Send WiFi SSID, password, and hidden network flags directly over BLE characteristic (`sendWifiCredentialsOverBle`).
- [x] **4.5** Add permission checks and user guide for Bluetooth access across `en.ts`, `de.ts`, `pt_BR.ts`, and `vi.ts`.

---

## Phase 5: Smart Home & Home Assistant Voice Commands

**Goal**: Allow users to control smart lights, switches, fans, and appliances in Bengali and English by voice (*"লিভিং রুমের লাইট জ্বালাও"* / *"Turn on living room light"*).

### Core AI Server (`xiaozhi-server`)
- [x] **5.1** Enhance `plugins_func/functions/hass_state.py` & `hass_init.py`:
  - Add Bengali entity mappings and natural language intent parsing for device switches.
- [x] **5.2** Support dynamic Home Assistant URL and Token configuration per agent/user.

### Web & Mobile Configuration
- [x] **5.3** Add Smart Home Integration tab in `manager-web` under Agent Tools / Plugins.
- [x] **5.4** Add Home Assistant configuration dialog in `manager-mobile` (`src/pages/agent/provider.vue` or tools config).


---

## Phase 6: Voiceprint Security & Speaker-Restricted Actions

**Goal**: Use the existing voiceprint recognition service to verify the speaker before executing sensitive commands (e.g. device reboot, smart locks, account changes).

### Backend (`xiaozhi-server` & `manager-api`)
- [x] **6.1** Connect live audio stream chunks to voiceprint verification during intent handling.
- [x] **6.2** Add "Admin Speaker Only" policy flag for sensitive functions.

### Mobile & Web Management
- [x] **6.3** Add Voiceprint Security settings in `manager-mobile/src/pages/voiceprint/index.vue`:
  - "Require Voice Match for Smart Home Commands" toggle.
  - "Confidence Threshold" slider (default: 70%).

---

## Phase 7: Analytics, Latency & Token Usage Dashboard

**Goal**: Provide full visibility into daily voice queries, model latency breakdown (ASR -> LLM -> TTS), and token consumption.

### Backend (`manager-api`)
- [x] **7.1** Aggregate conversation stats table: query count, response duration, token usage per user/device.
- [x] **7.2** Create stats endpoints: `GET /stats/summary` and `GET /stats/daily-usage`.

### Web Console (`manager-web`)
- [x] **7.3** Modernize `src/views/home.vue` with ECharts:
  - 24-hour / 7-day query volume and token consumption chart.
  - Average latency gauge and breakdown (ASR ms, LLM ms, TTS ms).
  - Top active devices and agents with activity indicators.
