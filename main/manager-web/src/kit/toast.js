import { reactive } from 'vue';

// Short notices shown by <TbToastHost>. Kinds: success, error, warning, info.
export const toastState = reactive({ items: [] });
let seq = 0;

function push(kind, message, opts = {}) {
  if (message === undefined || message === null || message === '') return null;
  const id = ++seq;
  const duration = opts.duration ?? (kind === 'error' ? 5200 : 3200);
  toastState.items.push({ id, kind, message: String(message) });
  if (toastState.items.length > 3) toastState.items.shift();
  if (duration > 0) setTimeout(() => dismiss(id), duration);
  return id;
}

export function dismiss(id) {
  const i = toastState.items.findIndex((t) => t.id === id);
  if (i >= 0) toastState.items.splice(i, 1);
}

export const toast = {
  success: (m, o) => push('success', m, o),
  error: (m, o) => push('error', m, o),
  warning: (m, o) => push('warning', m, o),
  info: (m, o) => push('info', m, o),
  dismiss,
};

// Element-style call shapes ($message('text'), $message({ message, type })) for older code.
export function message(arg) {
  if (typeof arg === 'string') return toast.info(arg);
  if (arg && typeof arg === 'object') return push(arg.type || 'info', arg.message, { duration: arg.duration });
  return null;
}
message.success = toast.success;
message.error = toast.error;
message.warning = toast.warning;
message.info = toast.info;
