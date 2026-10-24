// TinyBot companion (alarms, reminders, focus timer, prayer times, night mode, messages).
// Shapes follow docs/companion-api.md and xiaozhi-server core/companion (schema.py, service.py).

/** Weekday bitmask: bit 0 = Sunday ... bit 6 = Saturday, 127 = every day */
export type DaysMask = number

export interface CompanionAlarm {
  id?: string
  /** "HH:MM" */
  time: string
  days: DaysMask
  /** Shown on the OLED: printable ASCII only, at most 24 characters */
  label: string
  enabled: boolean
  /** 0-60 */
  snooze_min: number
  /** Spoken text (max 300), may contain {weather}, {date}, {name} */
  say?: string
  say_audio?: string | null
}

export type ReminderKind = 'water' | 'medicine' | 'custom'
export type ReminderMode = 'interval' | 'time'

export interface CompanionReminder {
  id?: string
  kind: ReminderKind
  label: string
  enabled: boolean
  mode: ReminderMode
  days: DaysMask
  say?: string
  /** interval mode: 5-720 */
  every_min?: number
  /** interval mode: "HH:MM" */
  from?: string
  /** interval mode: "HH:MM" */
  to?: string
  /** time mode: "HH:MM" */
  time?: string
  say_audio?: string | null
}

export interface NightSettings {
  enabled: boolean
  start: string
  end: string
  dim: boolean
  lullaby: boolean
  light: boolean
}

export interface CareSettings {
  enabled: boolean
  /** 10-1440 */
  lonely_after_min: number
}

export interface CompanionSettings {
  /** null = the robot keeps its own volume */
  volume: number | null
  sounds: boolean
  owner_name?: string
  night: NightSettings
  care: CareSettings
}

export interface PomodoroConfig {
  work_min: number
  short_break_min: number
  long_break_min: number
  rounds: number
}

export interface PrayerDay {
  date: string
  fajr: string
  sunrise: string
  dhuhr: string
  asr: string
  maghrib: string
  isha: string
}

export interface PrayerView {
  enabled: boolean
  remind: boolean
  city: string
  lat?: number | null
  lon?: number | null
  /** Today and tomorrow; empty when disabled */
  days: PrayerDay[]
  audio?: Record<string, string | null>
}

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'storm' | 'snow'

export interface WeatherView {
  ok: boolean
  city: string
  temp?: number
  feels?: number
  hi?: number
  lo?: number
  humidity?: number
  rain_prob?: number
  code?: number
  kind?: WeatherKind
  text?: string
  is_day?: boolean
  updated?: number
  rain_audio?: string | null
  lat?: number | null
  lon?: number | null
}

export interface CompanionStats {
  fw?: string
  ip?: string
  rssi?: number
  uptime_s?: number
  state?: string
  volume?: number
  bond_score?: number
  bond_level?: number
  mood?: string
  streak?: number
  pomodoros_today?: number
  last_touch_s?: number
  high_scores?: Record<string, number>
}

export type CompanionEventType
  = | 'alarm_dismissed'
    | 'alarm_snoozed'
    | 'alarm_missed'
    | 'reminder_done'
    | 'reminder_missed'
    | 'prayer_reminded'
    | 'pomodoro_done'
    | 'game_score'
    | 'streak'
    | 'dropped'
    | 'lonely'

export interface CompanionEvent {
  type: CompanionEventType | string
  id?: string
  value?: number
  /** Device time (unix seconds) */
  ts: number
  /** Server receive time (unix seconds) */
  rx?: number
}

export type MessageAnswer = 'yes' | 'no' | 'seen'

export interface CompanionMessage {
  id: string
  from: string
  from_ascii?: string
  text: string
  text_ascii?: string
  ask: boolean
  ts: number
  status: 'pending' | 'delivered'
  delivered_ts?: number | null
  answer?: MessageAnswer | null
  answer_ts?: number | null
  audio?: string | null
}

export type CommandType = 'story' | 'pomodoro' | 'lullaby' | 'ring' | 'breathe' | 'night_light' | 'game'
export type GameName = 'catch' | 'simon' | 'dice' | 'reaction'

export interface CompanionCommand {
  id: string
  type: CommandType
  arg: string
  ts: number
  status: 'pending' | 'done'
  done_ts?: number | null
}

/** GET /device/companion/{deviceId} */
export interface CompanionDevice {
  id: string
  name: string
  online: boolean
  /** unix seconds, 0 = never */
  last_seen: number
  stats: CompanionStats
  stats_updated?: number
  rev: number
  created?: number
  settings: CompanionSettings
  pomodoro: PomodoroConfig
  alarms: CompanionAlarm[]
  reminders: CompanionReminder[]
  prayer: PrayerView
  weather: WeatherView
  /** newest first */
  events: CompanionEvent[]
  /** newest first */
  messages: CompanionMessage[]
  /** newest first */
  commands: CompanionCommand[]
}

export interface LocationPatch {
  city?: string
  lat?: number
  lon?: number
}

/** PUT /device/companion/{deviceId}/config: every key is optional, sections are merged */
export interface CompanionConfigPatch {
  name?: string
  settings?: {
    volume?: number | null
    sounds?: boolean
    owner_name?: string
    night?: Partial<NightSettings>
    care?: Partial<CareSettings>
  }
  pomodoro?: Partial<PomodoroConfig>
  /** Replaces the whole list */
  alarms?: CompanionAlarm[]
  /** Replaces the whole list */
  reminders?: CompanionReminder[]
  prayer?: LocationPatch & { enabled?: boolean, remind?: boolean }
  weather?: LocationPatch
}

export interface SendMessageBody {
  from: string
  text: string
  ask: boolean
}

export interface CommandBody {
  type: CommandType
  arg?: string
}

export interface GeocodeResult {
  name: string
  country?: string
  admin1?: string
  lat: number
  lon: number
  timezone?: string
}
