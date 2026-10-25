// Wake word & theme (back office): pure helpers of the page, kept apart so they can be tested
// without mounting it. The assets.bin format itself lives in src/utils/tinybotAssets.mjs.
import { WAKE_WORDS } from '@/utils/tinybotAssets.mjs';

// The install, in the order the legacy page ran it.
export const STEP_KEYS = ['build', 'check', 'upload', 'link', 'reboot', 'install'];

// The languages the WakeNet catalogue offers, in the order the legacy select grouped them.
export const WAKE_LANGS = ['en', 'zh'];

/** Wake words of one language whose phrase, native spelling or model id contains the query. */
export function filterWakeWords({ lang = '', query = '', list = WAKE_WORDS } = {}) {
  const q = String(query || '').trim().toLowerCase();
  return list.filter((w) => (!lang || w.lang === lang)
    && (!q || [w.phrase, w.native, w.id].some((s) => s && String(s).toLowerCase().includes(q))));
}

/** How many phrases each language has: { en: 23, zh: 30 }. */
export function countByLang(list = WAKE_WORDS) {
  const out = {};
  for (const w of list) out[w.lang] = (out[w.lang] || 0) + 1;
  return out;
}

/** "ESP32-S3" from the chip_model_name the robot reports ("esp32s3"). */
export function chipName(info) {
  const raw = info && info.chip_model_name ? String(info.chip_model_name) : '';
  return raw.toUpperCase().replace(/^ESP32(?=[A-Z])/, 'ESP32-');
}

/** Flash size in whole megabytes ("4 MB"), or '' when the robot did not say. */
export function flashText(info) {
  const size = info && Number(info.flash_size);
  return size > 0 ? `${Math.round(size / (1024 * 1024))} MB` : '';
}

/** Share of the partition the file takes, clamped to 0..1 for the meter. */
export function fillRatio(total, limit) {
  if (!(limit > 0) || !(total > 0)) return 0;
  return Math.min(1, total / limit);
}
