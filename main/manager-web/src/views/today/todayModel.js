// Today's almanac rows from the companion view (pure: unit tested).
// days bitmask: bit 0 = Sunday ... bit 6 = Saturday (docs/companion-api.md).

const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

function firesToday(days, date) {
  const mask = days === undefined || days === null ? 127 : days;
  return Boolean(mask & (1 << date.getDay()));
}

/**
 * rows: [{ key, time, title, note, ink, stateText, sync }] for TbDayTable.
 * t(key, params) translates; `view` is GET /device/companion/{id}.
 */
export function dayRows(view, date, t) {
  if (!view) return [];
  const rows = [];
  const prayer = view.prayer || {};
  const today = (prayer.days || []).find((d) => d.date === isoDate(date)) || (prayer.days || [])[0];
  if (prayer.enabled !== false && today) {
    for (const k of PRAYERS) {
      if (today[k] && today[k] !== '--:--') {
        rows.push({ key: `p-${k}`, time: today[k], title: t(`today.prayer.${k}`), ink: 'prayer',
          stateText: prayer.remind !== false ? t('today.willRemind') : '' });
      }
    }
  }
  for (const a of view.alarms || []) {
    if (!a.enabled || !firesToday(a.days, date)) continue;
    rows.push({ key: `a-${a.id}`, time: a.time, title: a.label || t('today.alarm'), ink: 'alarm', stateText: t('today.alarm') });
  }
  for (const r of view.reminders || []) {
    if (!r.enabled || r.mode !== 'time' || !firesToday(r.days, date)) continue;
    rows.push({ key: `r-${r.id}`, time: r.time, title: r.label || t('today.reminder'), ink: 'alarm', stateText: t('today.reminder') });
  }
  const routine = view.settings && view.settings.routine;
  if (routine && routine.enabled !== false) {
    for (const it of routine.items || []) {
      rows.push({ key: `l-${it.start}-${it.activity}`, time: it.start, title: t(`today.activity.${it.activity}`),
        note: it.end ? t('today.until', { time: it.end }) : '', ink: 'routine', stateText: t('today.routine') });
    }
  }
  const night = view.settings && view.settings.night;
  if (night && night.enabled && night.start) {
    rows.push({ key: 'night', time: night.start, title: t('today.night'), ink: 'message', stateText: t('today.nightUntil', { time: night.end || '' }) });
  }
  return rows;
}

export function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The robot's state word: online, offline, sleeping (night window), updating. */
export function robotState(view, now = new Date()) {
  if (!view) return 'offline';
  if (!view.online) return 'offline';
  const st = (view.stats && view.stats.state) || '';
  if (/update|ota/i.test(st)) return 'updating';
  const night = view.settings && view.settings.night;
  if (night && night.enabled && night.start && night.end) {
    const m = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = night.start.split(':').map(Number); const [eh, em] = night.end.split(':').map(Number);
    const s = sh * 60 + sm; const e = eh * 60 + em;
    if (s > e ? (m >= s || m < e) : (m >= s && m < e)) return 'sleeping';
  }
  return 'online';
}

/** Whole days since the robot was first set up (`created`, seconds), or null. */
export function daysTogether(view, now = Date.now()) {
  const c = view && view.created;
  if (!c) return null;
  return Math.max(1, Math.floor((now / 1000 - c) / 86400) + 1);
}
