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
  /** Night light timeout, 0-600 minutes; 0 = until the night ends (1 hour when started by hand) */
  light_minutes?: number
}

/** Minutes without touch or talk before the OLED dims / turns off; 0 = never */
export interface DisplaySettings {
  /** 0-120, default 3 */
  dim_after_min: number
  /** 0-600, default 20 */
  off_after_min: number
}

export interface CareSettings {
  enabled: boolean
  /** 10-1440 */
  lonely_after_min: number
}

/** The robot's info pages (shown when you hold its head); all default true */
export type RobotPage = 'clock' | 'weather' | 'prayer' | 'focus' | 'games' | 'breathe' | 'story' | 'night' | 'status' | 'bond'
export type RobotPages = Record<RobotPage, boolean>

/** How TinyBot's face looks and behaves (settings.look); missing keys = the original face */
export type LookShape = 'rounded' | 'round' | 'square'
export type LookEyes = 'plain' | 'shine' | 'pupil'
export type LookMouth = 'none' | 'smile' | 'cat' | 'dot'
export type LookBlink = 'slow' | 'normal' | 'fast'
export type LookEnergy = 'calm' | 'normal' | 'playful'

export interface FaceLook {
  shape: LookShape
  /** percent, 75-125 */
  size: number
  /** px each eye moves outward, -10..10 */
  spacing: number
  /** px down, -6..6 */
  height: number
  eyes: LookEyes
  mouth: LookMouth
  blush: boolean
  blink: LookBlink
  /** how often it looks around and does idle habits */
  energy: LookEnergy
  /** little paws in some expressions (yawn, like, wave, thinking, surprised, shy); default true */
  hands: boolean
}

/** TinyBot's day (settings.routine): what it is busy with while nobody plays with it */
export type RoutineActivity
  = | 'exercise'
    | 'boxing'
    | 'breakfast'
    | 'lunch'
    | 'dinner'
    | 'newspaper'
    | 'chat'
    | 'work'
    | 'nap'
    | 'tea'
    | 'art'
    | 'tv'
    | 'book'

export interface RoutineItem {
  /** HH:MM */
  start: string
  /** HH:MM, != start; earlier than start = crosses midnight */
  end: string
  activity: RoutineActivity
}

export interface RoutineSettings {
  /** default true */
  enabled: boolean
  /** at most 24; the server sorts them by start */
  items: RoutineItem[]
}

export interface CompanionSettings {
  /** null = the robot keeps its own volume */
  volume: number | null
  sounds: boolean
  owner_name?: string
  night: NightSettings
  care: CareSettings
  pages?: RobotPages
  look?: Partial<FaceLook>
  display?: Partial<DisplaySettings>
  /** missing on older robots: the default day */
  routine?: Partial<RoutineSettings>
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
  /** TinyBot's day: the activity it shows right now ('' = not busy) */
  activity?: RoutineActivity | ''
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

/** `stop` closes whatever the robot shows; `night` takes 'on' | 'off' */
export type CommandType = 'story' | 'pomodoro' | 'lullaby' | 'ring' | 'breathe' | 'night_light' | 'game' | 'stop' | 'night'
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
    pages?: Partial<RobotPages>
    look?: Partial<FaceLook>
    display?: Partial<DisplaySettings>
    /** `items` replaces the whole list */
    routine?: Partial<RoutineSettings>
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
