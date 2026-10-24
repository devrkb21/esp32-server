# TinyBot Companion API (v1)

The companion API lets the TinyBot firmware fetch its schedule (alarms, reminders, focus timer,
night mode, prayer times, weather) and pending phone messages/commands from xiaozhi-server, and
lets manager-web and manager-mobile configure all of it through manager-api. It is served by the
xiaozhi-server HTTP server (port 8003, same as OTA), in standalone mode as well as with
manager-api.

Everything the robot needs to work offline (alarms, reminders, focus timer, prayer times for
today and tomorrow, last weather) is cached on the device; the server only has to be reachable
for changes, new messages and spoken (TTS) audio.

## Conventions

* JSON, UTF-8. Times of day are local `"HH:MM"` (24 h). Dates are `"YYYY-MM-DD"`.
* `days` is a weekday bitmask, bit 0 = Sunday ... bit 6 = Saturday (127 = every day).
* Audio URLs are paths relative to the server base (`http://host:8003`), pointing at Ogg Opus
  files (mono, 16 kHz, 60 ms frames: what the firmware notify player streams).
* Device requests carry the same headers as the OTA request: `Device-Id` (MAC, lowercase,
  `aa:bb:cc:dd:ee:ff`), `Client-Id` (UUID) and `User-Agent`. A device that syncs for the first
  time is created with default settings.
* App requests carry `Authorization: Bearer <companion.app_token>` when `app_token` is set in
  the server config (requests without it get 401). Device endpoints are not token protected
  (same as OTA; LAN only).

## Device endpoints

### `GET /companion/v1/device/sync`

Polled by the robot while Wi-Fi is up. Always returns the full snapshot.

Long-poll: `?wait=<seconds>&rev=<rev the robot has>` holds the answer (up to `long_poll`, 25 s)
until something is new for the robot: a different `rev`, an unacknowledged command, or a message
whose audio is ready (or that is older than 15 s). An app command therefore reaches the robot
within a fraction of a second instead of after the next `poll_s` poll. Without `wait` the answer
is immediate, as before. The robot re-polls right after each answer (at most every 2 s).

MQTT push: when the server knows the MQTT gateway (`companion.mqtt_api` + `mqtt_signature_key`,
else `server.mqtt_manager_api` / `server.mqtt_signature_key`) and the robot is connected to it
(the robot sends its MQTT client id as the `Mqtt-Client-Id` header; the gateway's
`/api/devices/status` says it exists), the snapshot carries `"push": "mqtt"` and the robot stops
long-polling (it polls every `poll_s` as a fallback). The server then pushes through the gateway's
`/api/commands/<client id>` as MCP tool calls: each pending command as `self.companion.command`
{id, type, arg} (acknowledged by the call itself), and `self.companion.sync` when `rev` or the
ready messages changed, after which the robot fetches the snapshot. Snapshots stay on HTTP (the
MQTT payload limit is 8 KB). A failed push leaves everything for the HTTP sync.

```json
{
  "rev": 7,
  "server_time": 1793000000,
  "poll_s": 30,
  "long_poll": 25,
  "settings": {
    "volume": null,
    "sounds": true,
    "night": {"enabled": true, "start": "21:30", "end": "06:30", "dim": true, "lullaby": true, "light": false},
    "care": {"enabled": true, "lonely_after_min": 180},
    "pages": {"clock": true, "weather": true, "prayer": true, "focus": true, "games": true,
              "breathe": true, "story": true, "night": true, "status": true, "bond": true}
  },
  "pomodoro": {"work_min": 25, "short_break_min": 5, "long_break_min": 15, "rounds": 4},
  "alarms": [
    {"id": "a1", "time": "06:30", "days": 62, "label": "Wake up", "enabled": true,
     "snooze_min": 5, "say_audio": "/companion/v1/audio/3f2a....ogg"}
  ],
  "reminders": [
    {"id": "r1", "kind": "water", "label": "Drink water", "enabled": true,
     "mode": "interval", "every_min": 60, "from": "09:00", "to": "21:00", "days": 127,
     "say_audio": "/companion/v1/audio/....ogg"},
    {"id": "r2", "kind": "medicine", "label": "Medicine", "enabled": true,
     "mode": "time", "time": "21:00", "days": 127, "say_audio": null}
  ],
  "prayer": {
    "enabled": true, "remind": true, "city": "Dhaka",
    "days": [
      {"date": "2026-10-24", "fajr": "04:48", "sunrise": "06:02", "dhuhr": "11:44",
       "asr": "15:48", "maghrib": "17:26", "isha": "18:40"},
      {"date": "2026-10-25", "fajr": "04:49", "sunrise": "06:02", "dhuhr": "11:44",
       "asr": "15:47", "maghrib": "17:25", "isha": "18:40"}
    ],
    "audio": {"fajr": "/companion/v1/audio/....ogg", "dhuhr": "...", "asr": "...", "maghrib": "...", "isha": "..."}
  },
  "weather": {
    "ok": true, "city": "Dhaka", "temp": 29, "feels": 33, "hi": 31, "lo": 24, "humidity": 78,
    "rain_prob": 60, "code": 61, "kind": "rain", "text": "Rain", "is_day": true,
    "updated": 1793000000, "rain_audio": "/companion/v1/audio/....ogg"
  },
  "messages": [
    {"id": "m1", "from": "Ammu", "from_ascii": "Ammu", "text": "খেয়েছো?", "text_ascii": "",
     "audio": "/companion/v1/audio/m1.ogg", "ask": true, "ts": 1793000000}
  ],
  "commands": [
    {"id": "c1", "type": "story", "arg": ""}
  ]
}
```

Field notes:

* `rev` changes whenever anything in `settings`, `pomodoro`, `alarms`, `reminders` or `prayer`
  changes: app/voice edits, and also server-derived data (a `say_audio`/`audio` URL that became
  available after rendering, a new prayer day after midnight, a re-rendered `{weather}` line).
  It never changes for `weather`, `messages` or `commands`, which the robot reads on every poll.
* `settings.volume`: when not null the robot sets its speaker volume to it once per change.
* `label`, `from_ascii`, `text_ascii`: the OLED fonts are ASCII only, so the robot shows these
  and speaks the audio; empty means "show a generic icon/text instead".
* `say_audio` / `audio`: pre-rendered TTS (Bangla voice) of the alarm/reminder/message text;
  null when there is no spoken text. `{weather}`, `{date}` and `{name}` in a `say` text are
  filled in by the server (re-rendered when the result changes): `{weather}` is a short Bangla
  sentence ("আজ আবহাওয়া মেঘলা, তাপমাত্রা ২৯ ডিগ্রি"), `{date}` e.g. "২৪ অক্টোবর, শনিবার", `{name}`
  is `settings.owner_name` (app setting, not sent to the robot) or else the robot `name`. While a
  changed text is being rendered the previous URL is kept; brand new texts are null until ready.
* `prayer.days` is empty when prayer is disabled; `prayer.audio` values are null when `remind` is
  off. Default lines: "ফজরের/যোহরের/আসরের/মাগরিবের/এশার নামাজের সময় হয়েছে।".
* `weather` is `{"ok": false, "city": ...}` until the first Open-Meteo fetch succeeded; afterwards
  the last good value is served (cached 20 min, refreshed in the background, never blocks sync).
* Message audio speaks "<from> বলেছে, <text>" (just the text when `from` is empty).
* `weather.kind`: one of `clear`, `partly`, `cloudy`, `fog`, `drizzle`, `rain`, `storm`, `snow`.
  `rain_audio` is a short spoken "take an umbrella" line, set when `rain_prob >= 60`.
* `messages` and `commands` stay in the snapshot until the robot acknowledges them.
* `move_to` (only when `companion.move_to` is configured): `{"ota_url", "companion_url"}`. The
  robot saves them (like the Wi-Fi portal does) and reboots when the OTA URL changed; from then
  on it syncs with `companion_url`. Used to move robots from the standalone server to a
  manager-api setup whose OTA is served by manager-api.
* `commands[].type`: `story` (arg = topic or empty), `pomodoro` (arg = work minutes or empty),
  `lullaby`, `ring` (find my robot), `breathe`, `night_light` (arg `on`/`off`), `game`
  (arg `catch`/`simon`/`dice`/`reaction`), `stop` (close every activity, queued alert and the
  info pages), `night` (arg `on`: start night mode now until tonight's end time; `off`: end
  tonight's night early, the schedule takes over again from the next night).
* `settings.look`: the face the user designed (TinyBot look page): `shape` rounded/round/square,
  `size` 75..125 (%), `spacing` -10..10 and `height` -6..6 (px), `eyes` plain/shine/pupil,
  `mouth` none/smile/cat/dot (follows the mood), `blush` bool, `blink` slow/normal/fast, `energy`
  calm/normal/playful (how often it looks around and plays idle habits). Missing keys = the
  original face.
* `settings.display`: `dim_after_min` (default 3) and `off_after_min` (default 20) minutes without
  touch or talk before the OLED dims / turns off; 0 = never.
* `settings.night.light_minutes`: the night light turns itself off after this many minutes; 0 =
  at the end of the night (or after an hour when started by hand).
* `settings.volume`: also written by manager-api's device Volume dialog, which sets the volume
  on the robot right away over MQTT; the robot reports its real volume as `stats.volume`.
* `settings.pages`: which info pages the robot shows when the head is held (all on by default;
  missing keys count as on). Pages switched off are skipped; with every page off a hold only
  plays a sound.

### `POST /companion/v1/device/report`

```json
{
  "acks": ["m1", "c1"],
  "replies": [{"id": "m1", "answer": "yes", "ts": 1793000100}],
  "events": [
    {"type": "alarm_dismissed", "id": "a1", "value": 0, "ts": 1793000000}
  ],
  "stats": {
    "fw": "2.2.4", "ip": "192.168.0.124", "rssi": -55, "uptime_s": 3600, "state": "idle",
    "volume": 70, "bond_score": 72, "bond_level": 2, "mood": "Happy", "streak": 5,
    "pomodoros_today": 2, "last_touch_s": 120,
    "high_scores": {"catch": 12, "simon": 7, "reaction_ms": 245}
  }
}
```

`answer` is `yes`, `no` or `seen`. Event types: `alarm_dismissed`, `alarm_snoozed`,
`alarm_missed`, `reminder_done`, `reminder_missed`, `prayer_reminded`, `pomodoro_done`
(value = rounds), `game_score` (id = game, value = score), `streak` (value = days),
`dropped`, `lonely`. Response: `{"ok": true}`.

Both device endpoints answer 400 `{"ok": false, "error": ...}` when `Device-Id` is missing.
An ack marks a message `delivered` (a reply does too) and a command `done`; a later `seen`
reply never overrides a `yes`/`no` answer. The server keeps the last 200 events and 100
messages per robot.

### Story requests over the chat WebSocket

To tell a story the robot opens a normal chat session and sends the listen/detect text
`[companion:story]<topic>` (topic may be empty). The server picks a topic when empty and asks
the LLM for a short (6-8 sentence) children's story in the configured TTS language
(`TTS.<selected>.language`). Empty topics are picked at random from `companion.story_topics`.

## App endpoints (token protected)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/companion/v1/devices` | List robots: id, name, online (seen < 90 s), last_seen, stats |
| GET | `/companion/v1/devices/{id}` | Full config + stats + recent events + messages |
| DELETE | `/companion/v1/devices/{id}` | Forget a robot (it is re-created with defaults on its next sync) |
| PUT | `/companion/v1/devices/{id}/config` | Partial update: `name`, `settings`, `pomodoro`, `alarms`, `reminders`, `prayer` (enabled, remind, city, lat, lon), `weather` (city, lat, lon). Alarms/reminders carry `say` text; bumps `rev` |
| POST | `/companion/v1/devices/{id}/messages` | `{from, text, ask}`: queue a message (TTS rendered at once) |
| GET | `/companion/v1/devices/{id}/messages` | Messages with status `pending` / `delivered` / reply answer |
| POST | `/companion/v1/devices/{id}/commands` | `{type, arg}`: queue a command |
| GET | `/companion/v1/devices/{id}/events` | Recent device events (`?limit=50`) |
| GET | `/companion/v1/geocode?q=Dhaka` | City search for the app (Open-Meteo geocoding) |
| GET | `/companion/v1/audio/{name}.ogg` | Rendered TTS audio (no token: the robot fetches it) |

App response shapes (all JSON; errors are `{"ok": false, "error": "..."}` with 400 for invalid
input, 401 without a valid token, 404 for an unknown robot, 502 when geocoding is down):

* `GET /devices` → `{"devices": [{id, name, online, last_seen, stats, stats_updated}], "server_time"}`.
* `GET /devices/{id}` and `PUT .../config` → the device: `id, name, online, last_seen, rev, created,
  settings` (incl. `owner_name`), `pomodoro`, `alarms` / `reminders` (stored items incl. `say`, plus
  `say_audio`), `prayer` (`enabled, remind, city, lat, lon, days, audio`), `weather` (snapshot
  weather plus `lat, lon`), `stats`, `events` (newest first, 30), `messages` (newest first, 30),
  `commands` (newest first, 20, with `status` `pending`/`done`).
* `PUT .../config`: `settings.night`, `settings.care`, `pomodoro`, `prayer` and `weather` are merged
  key by key; `alarms` and `reminders` replace the whole list (items keep their `id`; new items
  get one). Validation: times `HH:MM`, `days` 0-127, `label` reduced to 24 printable ASCII
  characters, `say` at most 300 characters, at most 20 alarms and 20 reminders. Reminder kinds
  `water`/`medicine`/`custom`, modes `interval` (`every_min` 5-720, `from`, `to`) or `time` (`time`).
* `POST .../messages` → the message `{id, from, from_ascii, text, text_ascii, ask, ts, status,
  delivered_ts, answer, answer_ts, audio}`; `from_ascii`/`text_ascii` may be given explicitly,
  otherwise they are the ASCII form of `from` and `text` (empty for non-ASCII text).
* `GET .../messages` → `{"messages": [...]}` (newest first, `status` `pending`/`delivered`).
* `POST .../commands` → `{id, type, arg, ts, status, done_ts}`.
* `GET .../events?limit=50` → `{"events": [{type, id, value, ts, rx}]}` (newest first, `rx` =
  server receive time).
* `GET /geocode?q=` → `{"results": [{name, country, admin1, lat, lon, timezone}]}`.

The app endpoints accept `Authorization: Bearer <token>` where the token is `companion.app_token`
or, when xiaozhi-server runs with manager-api, the shared `manager-api.secret`. With neither set
they are open (standalone LAN testing only).

## manager-api, manager-web and manager-mobile

manager-api forwards the app endpoints for the logged-in user's own devices
(`modules/device/controller/CompanionController.java`), authenticated with `server.secret`:

| Method | manager-api path | Forwards to |
| --- | --- | --- |
| GET | `/device/companion/{deviceId}` | `GET /companion/v1/devices/{mac}` |
| PUT | `/device/companion/{deviceId}/config` | `PUT .../config` |
| GET, POST | `/device/companion/{deviceId}/messages` | `.../messages` |
| POST | `/device/companion/{deviceId}/commands` | `.../commands` |
| GET | `/device/companion/{deviceId}/events?limit=50` | `.../events` |
| GET | `/device/companion/geocode?q=` | `/companion/v1/geocode` |

`deviceId` is manager-api's device id; it must belong to the user (else `DEVICE_NOT_EXIST`). The
xiaozhi-server address comes from the `server.companion_api` param when set, otherwise from the
host of `server.vision_explain`. Responses use the usual `Result` wrapper with the xiaozhi-server
JSON as `data`. manager-web and manager-mobile open the Companion screens from the device list.

## Server config

```yaml
companion:
  enabled: true
  app_token: ""          # set one to protect the app API
  data_dir: data/companion
  poll_s: 30
  # MQTT gateway management API and its signature key, for pushes (default: the manager-api
  # params server.mqtt_manager_api / server.mqtt_signature_key)
  mqtt_api: ""
  mqtt_signature_key: ""
  default_city: Dhaka
  default_lat: 23.8103
  default_lon: 90.4125
  prayer_method: Karachi # Fajr 18 deg, Isha 18 deg (Bangladesh)
  asr_method: Hanafi
  prayer_offsets: {}     # optional minutes per prayer, e.g. {dhuhr: 2}
  weather_cache_s: 1200
  voice: ""              # Edge TTS voice; empty = EdgeTTS voice from the TTS config
  story_topics: [...]
  # optional: prayer_say {fajr: ...}, rain_say "...", timezone_offset (default server.timezone_offset)
```

Without manager-api the block comes from `config.yaml` / `data/.config.local.yaml`; with
manager-api (whose server config has no `companion:` block) it is read from the local config
files. Device data lives in `<data_dir>/devices.json` (atomic writes), audio in
`<data_dir>/audio/<sha1(voice + text)>.ogg`.

The voice chat can manage the robot too (`companion_robot` in `Intent.function_call.functions`):
`companion_set_alarm`, `companion_list_alarms`, `companion_delete_alarm`,
`companion_add_reminder`, `companion_start_focus` (queues a `pomodoro` command) and
`companion_prayer_times`. They act on the talking robot's `Device-Id` and do nothing for a
robot that has never synced.

## LAN setup with manager-api (one PC)

1. `docker compose -f docker-compose.yml -f docker-compose.lan.yml up -d --build xiaozhi-esp32-server-db xiaozhi-esp32-server-redis xiaozhi-esp32-server-web`
   Then the MQTT gateway: `docker compose -f docker-compose.yml -f docker-compose.lan.yml up -d --build --no-deps xiaozhi-esp32-server-mqtt`
   (TCP 1883, UDP 8884; it bridges to the native xiaozhi-server through
   `main/mqtt-gateway/config-lan`). Robots get `<LAN_IP>:1883` from OTA (`LAN_IP`, default
   192.168.0.123). The device menu's Volume and Restart and the theme generator call the robot's
   MCP tools through it; companion data still syncs over HTTP long-poll.
2. In manager-web (`http://<pc>:18002`) set the params `server.websocket`
   (`ws://<pc>:8000/xiaozhi/v1/`), `server.ota` (`http://<pc>:18002/xiaozhi/ota/`) and
   `server.vision_explain` (`http://<pc>:8003/mcp/vision/explain`); add the robot to an agent.
3. `data/.config.manager.yaml` (gitignored): `server` address, `manager-api` url
   (`http://127.0.0.1:18002/xiaozhi`) and `secret` (= `server.secret`), and the `companion`
   section with `app_token` = the same secret. Start with `run-manager.ps1`.
4. Robots still on the standalone server move over when its config has `companion.move_to`.
