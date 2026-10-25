import type { InjectionKey } from 'vue'
import type { CommandType, CompanionConfigPatch, CompanionDevice } from '@/api/companion'
import { inject, reactive } from 'vue'
import { getCompanion, sendCompanionCommand, updateCompanionConfig } from '@/api/companion'
import { getCurrentLanguage, t } from '@/i18n'
import { dayPart, digits, timeText, timeWithPart } from '@/utils/calendar.mjs'
import { robot } from '@/utils/tbRobot'
import { toast } from '@/utils/toast'

export type SyncState = 'applied' | 'pending' | 'off' | 'error'

/**
 * The Day screen's controller, shared by its area panels (provide / inject): the companion view
 * of this robot, saving config patches (whole lists for alarms and reminders, partial sections
 * otherwise, as the legacy panels did), robot commands, and whether each area reached TinyBot.
 */
export interface DayCtx {
  view: CompanionDevice | null
  loading: boolean
  failed: boolean
  minute: number
  /** area -> a save is open */
  saving: Record<string, boolean>
  /** area -> the last save failed */
  saveFailed: Record<string, boolean>
  /** command being sent ('' = none) */
  busy: string
  lang: () => string
  num: (n: unknown) => string
  fmt: (hhmm: string | undefined | null) => string
  /** the day-part word set small before a big time numeral ('রাত'; '' in English) */
  part: (hhmm: string | undefined | null) => string
  /** the time numeral alone: 12-hour in Bangla, 24h otherwise */
  clock: (hhmm: string | undefined | null) => string
  refresh: (quiet?: boolean) => Promise<void>
  save: (patch: CompanionConfigPatch, area: string, okText?: string) => Promise<boolean>
  command: (type: CommandType, arg?: string | number, okText?: string, busyKey?: string) => Promise<boolean>
  syncOf: (area: string) => { state: SyncState, text: string }
}

export const dayKey: InjectionKey<DayCtx> = Symbol('day')

export function useDay(): DayCtx {
  const ctx = inject(dayKey)
  if (!ctx)
    throw new Error('useDay() must be used inside the Day page')
  return ctx
}

export function createDay(): DayCtx {
  const now = new Date()
  const day: DayCtx = reactive({
    view: null,
    loading: false,
    failed: false,
    minute: now.getHours() * 60 + now.getMinutes(),
    saving: {},
    saveFailed: {},
    busy: '',
    lang: () => getCurrentLanguage(),
    num: (n: unknown) => digits(n ?? '–', getCurrentLanguage()),
    // Bangla: the day part and 12-hour figures, like the wall calendar ('রাত ৯:০০'); 24h otherwise
    fmt: (hhmm: string | undefined | null) => (getCurrentLanguage() === 'bn' ? timeWithPart(hhmm || '', 'bn') : timeText(hhmm || '', getCurrentLanguage())) || '–',
    part: (hhmm: string | undefined | null) => dayPart(hhmm || '', getCurrentLanguage()),
    clock: (hhmm: string | undefined | null) => timeText(hhmm || '', getCurrentLanguage(), getCurrentLanguage() === 'bn') || '–',
    async refresh(quiet = false) {
      if (!robot.deviceId)
        return
      if (!quiet)
        day.loading = true
      try {
        const v = await getCompanion(robot.deviceId, quiet)
        if (v && typeof v === 'object')
          day.view = v as CompanionDevice
        day.failed = false
      }
      catch {
        // a failed background refresh keeps the last good view
        if (!quiet || !day.view)
          day.failed = true
      }
      day.loading = false
    },
    async save(patch: CompanionConfigPatch, area: string, okText?: string) {
      if (!robot.deviceId)
        return false
      day.saving = { ...day.saving, [area]: true }
      day.saveFailed = { ...day.saveFailed, [area]: false }
      try {
        const v = await updateCompanionConfig(robot.deviceId, patch)
        if (v && typeof v === 'object')
          day.view = v as CompanionDevice
        day.saving = { ...day.saving, [area]: false }
        toast.success(day.view?.online === false ? t('day.savedOffline') : (okText || t('day.saved')))
        return true
      }
      catch {
        // the request layer has already said what went wrong
        day.saving = { ...day.saving, [area]: false }
        day.saveFailed = { ...day.saveFailed, [area]: true }
        return false
      }
    },
    async command(type: CommandType, arg: string | number = '', okText?: string, busyKey?: string) {
      if (day.busy || !robot.deviceId)
        return false
      day.busy = busyKey || type
      try {
        await sendCompanionCommand(robot.deviceId, { type, arg: String(arg) })
        toast.success(day.view?.online === false ? t('day.sentOffline') : (okText || t('day.sent')))
        return true
      }
      catch {
        return false
      }
      finally {
        day.busy = ''
      }
    },
    syncOf(area: string) {
      if (day.saving[area])
        return { state: 'pending' as SyncState, text: t('common.sync.pending') }
      if (day.saveFailed[area])
        return { state: 'error' as SyncState, text: t('common.sync.error') }
      if (day.view && day.view.online === false)
        return { state: 'pending' as SyncState, text: t('day.sync.offline') }
      return { state: 'applied' as SyncState, text: t('common.sync.applied') }
    },
  }) as DayCtx
  return day
}
