// The almanac's dates: Bangla (Bangladesh revised calendar, 2019), hijri and Gregorian, and
// numerals in the reader's language. Pure functions: no Vue, unit tested.

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
export const BN_MONTHS = ['বৈশাখ', 'জ্যৈষ্ঠ', 'আষাঢ়', 'শ্রাবণ', 'ভাদ্র', 'আশ্বিন', 'কার্তিক', 'অগ্রহায়ণ', 'পৌষ', 'মাঘ', 'ফাল্গুন', 'চৈত্র'];
export const BN_MONTHS_LATIN = ['Boishakh', 'Joishtho', 'Asharh', 'Srabon', 'Bhadro', 'Ashwin', 'Kartik', 'Ogrohayon', 'Poush', 'Magh', 'Falgun', 'Chaitra'];

/** Digits in the reader's script: Bangla digits when lang is 'bn'. */
export function digits(value, lang) {
  const s = String(value ?? '');
  return lang === 'bn' ? s.replace(/[0-9]/g, (d) => BN_DIGITS[d]) : s;
}

function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

/**
 * Bangla date of a Gregorian date (Bangladesh calendar, revised 2019): the year starts on
 * 14 April; Boishakh to Ashwin have 31 days, Kartik to Magh and Chaitra 30, Falgun 29 (30 in a
 * Gregorian leap year). Returns { year, month (0-11), day }.
 */
export function banglaDate(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  let gy = d.getFullYear();
  let start = new Date(gy, 3, 14);
  if (d < start) { gy -= 1; start = new Date(gy, 3, 14); }
  const year = gy - 593;
  let offset = Math.round((d - start) / 86400000);
  const falgun = isLeap(gy + 1) ? 30 : 29;
  const lengths = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, falgun, 30];
  let month = 0;
  while (month < 11 && offset >= lengths[month]) { offset -= lengths[month]; month += 1; }
  return { year, month, day: offset + 1 };
}

/** "৯ কার্তিক ১৪৩৩" or "9 Kartik 1433". */
export function banglaDateText(date, lang, withYear = true) {
  const b = banglaDate(date);
  const month = lang === 'bn' ? BN_MONTHS[b.month] : BN_MONTHS_LATIN[b.month];
  return `${digits(b.day, lang)} ${month}${withYear ? ` ${digits(b.year, lang)}` : ''}`;
}

/** "কার্তিক ১৪৩৩" or "Kartik 1433": the almanac's month band. */
export function banglaMonthText(date, lang) {
  const b = banglaDate(date);
  return `${lang === 'bn' ? BN_MONTHS[b.month] : BN_MONTHS_LATIN[b.month]} ${digits(b.year, lang)}`;
}

function locale(lang) { return lang === 'bn' ? 'bn-BD' : (lang || 'en').replace('_', '-'); }

/** The hijri date in the reader's language, e.g. "২৩ রবিউস সানি ১৪৪৮". */
export function hijriText(date, lang) {
  try {
    return new Intl.DateTimeFormat(`${locale(lang)}-u-ca-islamic-umalqura`, { day: 'numeric', month: 'long', year: 'numeric' })
      .format(date).replace(/\s*(AH|যুগ)$/u, '');
  } catch (e) {
    return '';
  }
}

export function weekdayText(date, lang) {
  return new Intl.DateTimeFormat(locale(lang), { weekday: 'long' }).format(date);
}

export function gregorianMonthText(date, lang) {
  return digits(new Intl.DateTimeFormat(locale(lang), { month: 'long', year: 'numeric' }).format(date), lang);
}

/** "HH:MM" (24h) shown in the reader's numerals; `twelve` gives "৩:৪৫" style without am/pm. */
export function timeText(hhmm, lang, twelve = false) {
  if (!hhmm) return '';
  let [h, m] = String(hhmm).split(':').map(Number);
  if (twelve) h = h % 12 || 12;
  const s = `${twelve ? h : String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return digits(s, lang);
}

/** Minutes since midnight of an "HH:MM" string. */
export function minutesOf(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * The Bangla day-part word for an "HH:MM" time, so 12-hour Bangla times are not ambiguous:
 * রাত before 4:00, ভোর to 6:00, সকাল to 12:00, দুপুর to 15:00, বিকেল to 17:00, সন্ধ্যা to 20:00,
 * then রাত. Empty for other languages (their times stay 24-hour).
 */
export function dayPart(hhmm, lang) {
  if (lang !== 'bn' || !hhmm) return '';
  const m = minutesOf(hhmm);
  if (m < 240) return 'রাত';
  if (m < 360) return 'ভোর';
  if (m < 720) return 'সকাল';
  if (m < 900) return 'দুপুর';
  if (m < 1020) return 'বিকেল';
  if (m < 1200) return 'সন্ধ্যা';
  return 'রাত';
}

/** "রাত ৯:০০" in Bangla, "21:00" otherwise. */
export function timeWithPart(hhmm, lang) {
  if (lang !== 'bn') return timeText(hhmm, lang);
  if (!hhmm) return '';
  return `${dayPart(hhmm, lang)} ${timeText(hhmm, lang, true)}`;
}
