import { reactive } from 'vue'

/**
 * One question at a time, drawn by <tb-confirm-host> (in every layout) as a bottom sheet.
 * tbConfirm({ title, message, confirmText, cancelText, danger }) resolves true / false.
 */
export interface ConfirmOptions { title?: string, message: string, confirmText?: string, cancelText?: string, danger?: boolean }

export const confirmState = reactive<{ open: boolean, current: (ConfirmOptions & { resolve: (v: boolean) => void }) | null }>({ open: false, current: null })
const queue: (ConfirmOptions & { resolve: (v: boolean) => void })[] = []

function next() {
  if (confirmState.open || !queue.length)
    return
  confirmState.current = queue.shift()!
  confirmState.open = true
}

export function tbConfirm(o: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    queue.push({ ...o, resolve })
    next()
  })
}

export function settleConfirm(ok: boolean) {
  const c = confirmState.current
  if (!c)
    return
  confirmState.open = false
  confirmState.current = null
  c.resolve(ok)
  setTimeout(next, 200)
}
