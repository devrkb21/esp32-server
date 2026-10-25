// Words for the Day page's values (pure; `t` translates, `fmt` writes a time, `num` a number).
import { daysOf, daysPreset, minuteOfDay, routineItemMinutes } from '@/utils/companion.mjs';

/** "Every day", "Sun–Thu", "Once", or the days in order ("Sun, Tue"). */
export function daysText(mask, t) {
  const preset = daysPreset(mask);
  if (preset) return t(`day.preset.${preset}`);
  return daysOf(mask).map((d) => t(`day.weekday.${d}`)).join(', ');
}

/** "every 90 min, 9:00 to 21:00" or "11:30", then the days. */
export function reminderWhen(r, t, fmt = (x) => x, num = (x) => x) {
  const when = r.mode === 'interval'
    ? t('day.reminder.whenInterval', { every: num(r.every_min), from: fmt(r.from), to: fmt(r.to) })
    : fmt(r.time);
  return `${when}, ${daysText(r.days, t)}`;
}

/** "45 min", "1 h 30 min", "2 h", plus "to the next day" when it crosses midnight. */
export function durationText(item, t, num = (x) => x) {
  const n = routineItemMinutes(item);
  const h = Math.floor(n / 60);
  const m = n % 60;
  let text = t('day.routine.durationMin', { n: num(n) });
  if (h && m) text = t('day.routine.durationHours', { h: num(h), m: num(m) });
  else if (h) text = t('day.routine.durationHoursOnly', { h: num(h) });
  return minuteOfDay(item.end) < minuteOfDay(item.start) ? `${text}, ${t('day.routine.nextDay')}` : text;
}
