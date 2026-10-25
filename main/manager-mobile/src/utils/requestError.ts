import { requestErrorMessage, wasShown } from '@/http/request/errorText.mjs'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'

/**
 * The words for a failed request, for a screen: the server's own message only when it is meant
 * for people, otherwise a plain line (src/http/request/errorText.mjs). `fallbackKey` names what
 * failed in the screen's words. Never raw server, HTTP or stack text.
 */
export function requestErrorText(err: unknown, fallbackKey: string): string {
  const said = requestErrorMessage(err, fallbackKey) as { key?: string, text?: string }
  return said.text || t(said.key || fallbackKey)
}

/**
 * Toast a failed request once: nothing when the request layer already showed it, else the plain
 * line. The raw error goes to the console.
 */
export function notifyRequestError(err: unknown, fallbackKey: string) {
  console.warn('[Request failed]', err)
  if (wasShown(err))
    return
  toast.error(requestErrorText(err, fallbackKey))
}

export { wasShown }
