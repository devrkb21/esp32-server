import { reactive } from 'vue';

// One question at a time, shown by <TbConfirmHost> as a sheet. Resolves on confirm, rejects
// with 'cancel' on cancel (the same contract as Element's $confirm, so `.then().catch()` works).
//   confirm(message, title?, { confirmText, cancelText, danger, input, inputValue, inputPlaceholder })
// With `input: true` it resolves with { value } (a one-field prompt).
export const confirmState = reactive({ open: false, current: null });
const queue = [];

function next() {
  if (confirmState.open || !queue.length) return;
  confirmState.current = queue.shift();
  confirmState.open = true;
}

export function confirm(message, title, opts) {
  if (title && typeof title === 'object') { opts = title; title = undefined; }
  const o = opts || {};
  return new Promise((resolve, reject) => {
    queue.push({
      message: message || '',
      title: title || o.title || '',
      confirmText: o.confirmText || o.confirmButtonText || '',
      cancelText: o.cancelText || o.cancelButtonText || '',
      danger: Boolean(o.danger || o.type === 'error' || o.type === 'warning'),
      input: Boolean(o.input),
      inputValue: o.inputValue || '',
      inputPlaceholder: o.inputPlaceholder || '',
      inputPattern: o.inputPattern || null,
      inputErrorMessage: o.inputErrorMessage || '',
      showCancel: o.showCancelButton !== false,
      resolve,
      reject,
    });
    next();
  });
}

export function settle(ok, value) {
  const c = confirmState.current;
  if (!c) return;
  confirmState.open = false;
  confirmState.current = null;
  if (ok) c.resolve(c.input ? { value } : 'confirm');
  else c.reject('cancel');
  setTimeout(next, 180);
}

export function prompt(message, title, opts = {}) {
  return confirm(message, title, { ...opts, input: true });
}

export function alert(message, title, opts = {}) {
  return confirm(message, title, { ...opts, showCancelButton: false }).catch(() => {});
}
