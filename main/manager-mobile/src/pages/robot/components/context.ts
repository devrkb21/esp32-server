import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { CommandType, CompanionConfigPatch, CompanionDevice } from '@/api/companion'
import type { Device, OtaFirmware } from '@/api/device'
import { inject } from 'vue'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'

/** State of the "Update now" flow (see ../../companion/firmwareUpdate.mjs) */
export interface FirmwareUpdateState {
  phase: 'idle' | 'sending' | 'sent' | 'waiting' | 'updated' | 'current' | 'timeout' | 'failed'
  fromVersion?: string
  toVersion?: string
  error?: unknown
}

export type SyncState = 'applied' | 'pending' | 'off' | 'error'

/**
 * The Robot screen is the controller its sections inject: the companion view of this robot,
 * saves as partial config patches (the answer replaces the view), commands, the sync state of
 * each area, and the firmware update flow.
 */
export interface RobotContext {
  deviceId: ComputedRef<string>
  agentId: ComputedRef<string>
  view: Ref<CompanionDevice | null>
  online: ComputedRef<boolean>
  lang: ComputedRef<string>
  /** ms, moved on with every fresh view */
  now: Ref<number>
  botName: ComputedRef<string>
  /** numbers in the reader's numerals */
  num: (n: number | string | null | undefined) => string
  /** "5 min ago" of a unix-seconds time */
  ago: (ts: number | null | undefined) => string
  /** HH:MM in the reader's clock */
  time: (hhmm: string) => string
  /** the translation of `key`, or `fallback` when there is none */
  tOr: (key: string, fallback: string) => string
  /** PUT a partial config; `area` names the sync state that shows it; resolves true on success */
  save: (patch: CompanionConfigPatch, area: string, okMsg?: string) => Promise<boolean>
  syncOf: (area: string) => { state: SyncState, text: string }
  saving: Record<string, boolean>
  /** Queue a robot command; resolves true on success */
  command: (type: CommandType, arg: string, okMsg?: string, busyKey?: string) => Promise<boolean>
  /** the job being sent ('' = none) */
  busy: Ref<string>
  reload: () => Promise<void>
  firmware: {
    state: Ref<FirmwareUpdateState>
    device: Ref<Device | null>
    latest: Ref<OtaFirmware | null>
    savingAuto: Ref<boolean>
    start: () => Promise<boolean>
    reset: () => void
    setAutoUpdate: (on: boolean) => Promise<void>
  }
}

export const robotKey: InjectionKey<RobotContext> = Symbol('robot')

export function useRobot(): RobotContext {
  const ctx = inject(robotKey)
  if (!ctx)
    throw new Error('useRobot() must be used inside the Robot screen')
  return ctx
}

/**
 * Toast a failed request. Business errors ("Request error [code]: msg") and HTTP status errors
 * are already shown by the request layer; network errors and timeouts are not.
 */
export function notifyError(error: unknown) {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (/^\[?Request error|HTTP request error/.test(raw))
    return
  toast.error(t('mrobot.requestFailed'))
}
