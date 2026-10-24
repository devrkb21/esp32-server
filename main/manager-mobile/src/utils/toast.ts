import { reactive } from 'vue'

/**
 * Short notices, drawn by <tb-toast-host> (in every layout) instead of uni.showToast, which cuts
 * Bangla text after a few characters. Same API as before: showToast(...) and toast.success(...).
 */
type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastOptions {
  type?: ToastType
  duration?: number
  position?: 'top' | 'middle' | 'bottom'
  icon?: string
  message: string
}

export const toastState = reactive<{ items: { id: number, kind: ToastType, message: string }[] }>({ items: [] })
let seq = 0

export function dismissToast(id: number) {
  const i = toastState.items.findIndex(t => t.id === id)
  if (i >= 0)
    toastState.items.splice(i, 1)
}

export function showToast(options: ToastOptions | string) {
  const o: ToastOptions = typeof options === 'string' ? { message: options } : options
  if (!o.message)
    return
  const id = ++seq
  const kind = o.type || 'info'
  toastState.items.push({ id, kind, message: String(o.message) })
  if (toastState.items.length > 3)
    toastState.items.shift()
  setTimeout(() => dismissToast(id), o.duration ?? (kind === 'error' ? 4200 : 2600))
}

export const toast = {
  success: (message: string, options?: Omit<ToastOptions, 'type' | 'message'>) => showToast({ ...options, type: 'success', message }),
  error: (message: string, options?: Omit<ToastOptions, 'type' | 'message'>) => showToast({ ...options, type: 'error', message }),
  warning: (message: string, options?: Omit<ToastOptions, 'type' | 'message'>) => showToast({ ...options, type: 'warning', message }),
  info: (message: string, options?: Omit<ToastOptions, 'type' | 'message'>) => showToast({ ...options, type: 'info', message }),
}
