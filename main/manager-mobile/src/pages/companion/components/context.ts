import type { InjectionKey, Ref } from 'vue'
import type { CommandType, CompanionConfigPatch, CompanionDevice } from '@/api/companion'
import { inject } from 'vue'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'
import { agoParts, describeDays } from '../companionUtils.mjs'

export interface CompanionContext {
  deviceId: Ref<string>
  /** Latest companion view from the server (null until loaded) */
  dev: Ref<CompanionDevice | null>
  /** PUT a partial config; resolves true on success (the view is replaced by the response) */
  save: (patch: CompanionConfigPatch, okMsg?: string) => Promise<boolean>
  /** Queue a robot command; resolves true on success */
  command: (type: CommandType, arg?: string, okMsg?: string) => Promise<boolean>
  /** Reload the view now */
  reload: () => Promise<void>
}

export const companionKey: InjectionKey<CompanionContext> = Symbol('companion')

export function useCompanion(): CompanionContext {
  const ctx = inject(companionKey)
  if (!ctx)
    throw new Error('useCompanion() must be used inside the companion page')
  return ctx
}

/**
 * Toast a failed request. Business errors ("Request error [code]: msg") and HTTP status errors
 * are already shown by the request layer; network errors and timeouts are not.
 */
export function notifyError(error: unknown) {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (/^Request error|HTTP request error/.test(raw))
    return
  toast.error(t('companion.requestFailed'))
}

/** "Every day", "Sun–Thu", "Mon, Wed", ... */
export function daysText(mask: number): string {
  const d = describeDays(mask)
  if (d.preset)
    return t(`companion.days.${d.preset}`)
  return d.days.map(k => t(`companion.day.${k}`)).join(', ')
}

/** "just now", "5 min ago", ... of a unix-seconds timestamp */
export function agoText(ts: number | null | undefined): string {
  const p = agoParts(ts)
  return t(`companion.${p.key}`, { n: p.n })
}

export const MOOD_EMOJI: Record<string, string> = {
  Happy: '😊',
  Sad: '😢',
  Sleepy: '😴',
  Bored: '😐',
  Excited: '🤩',
  Angry: '😠',
  Lonely: '🥺',
  Love: '🥰',
  Calm: '🙂',
}

export const WEATHER_EMOJI: Record<string, string> = {
  clear: '☀️',
  partly: '⛅',
  cloudy: '☁️',
  fog: '🌫️',
  drizzle: '🌦️',
  rain: '🌧️',
  storm: '⛈️',
  snow: '❄️',
}

/** Translated mood, falling back to the raw firmware value */
export function moodText(mood: string | undefined): string {
  if (!mood)
    return ''
  const key = `companion.mood.${mood}`
  const text = t(key)
  return text === key ? mood : text
}
