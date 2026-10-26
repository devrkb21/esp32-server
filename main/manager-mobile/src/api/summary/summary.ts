import { http } from '@/http/request/alova'

// Daily summary (manager-api): one row per robot and day, built at 21:00 and finalised at 23:55.
export interface DaySummary {
  day: string
  talkCount: number
  focusMinutes: number
  pomodoros: number
  gamesPlayed: number
  highScores: Record<string, number>
  remindersDone: number
  remindersMissed: number
  alarmsMissed: number
  newMemories: number
  mood: string | null
  bondScore: number | null
  bondLevel: number | null
  textBn: string
  textEn: string
  final: boolean
}

/** The last `days` days that have a summary, newest first. */
export function getSummaries(deviceId: string, days = 30) {
  return http.Get<DaySummary[]>(`/summary/device/${deviceId}`, { params: { days }, meta: { ignoreAuth: false, toast: false }, cacheFor: { expire: 0 } })
}

/** Build today's summary now. */
export function buildTodaySummary(deviceId: string) {
  return http.Post<DaySummary>(`/summary/device/${deviceId}/build`, {})
}
