import { t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'
import { lastSeen } from './robotsModel.mjs'

/** A count with its word: `${key}.one` for one in languages that need it, numerals in the UI language. */
export function countText(key: string, n: number, lang: string) {
  const one = `${key}.one`
  const k = n === 1 && t(one) !== one ? one : key
  return t(k, { n: digits(n, lang) })
}

/** "just now", "5 minutes ago", ... or the date itself after a week; "never" when unknown. */
export function whenText(value: unknown, lang: string, now = Date.now()) {
  const s: any = lastSeen(value, now)
  if (s.kind === 'never')
    return t('robots.never')
  if (s.kind === 'just')
    return t('robots.justNow')
  if (s.kind === 'minutes' || s.kind === 'hours' || s.kind === 'days')
    return t(`robots.${s.kind}Ago`, { n: digits(s.n, lang) })
  try {
    return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(s.at))
  }
  catch {
    return new Date(s.at).toLocaleDateString()
  }
}
