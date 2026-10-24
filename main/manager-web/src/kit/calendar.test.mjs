import { describe, expect, it } from 'vitest';
import { banglaDate, banglaDateText, digits, minutesOf, timeText } from './calendar.js';

const d = (y, m, day) => new Date(y, m - 1, day);

describe('banglaDate (Bangladesh revised calendar)', () => {
  it('starts the year on 14 April', () => {
    expect(banglaDate(d(2026, 4, 14))).toEqual({ year: 1433, month: 0, day: 1 });
    expect(banglaDate(d(2026, 4, 13))).toEqual({ year: 1432, month: 11, day: 30 });
  });
  it('matches the fixed national dates', () => {
    expect(banglaDate(d(2025, 12, 16))).toEqual({ year: 1432, month: 8, day: 1 }); // 1 Poush, Victory Day
    expect(banglaDate(d(2026, 2, 21))).toEqual({ year: 1432, month: 10, day: 8 }); // 8 Falgun
    expect(banglaDate(d(2026, 10, 17))).toEqual({ year: 1433, month: 6, day: 1 }); // 1 Kartik
  });
  it('writes Bangla numerals', () => {
    expect(banglaDateText(d(2026, 10, 25), 'bn')).toBe('৯ কার্তিক ১৪৩৩');
    expect(banglaDateText(d(2026, 10, 25), 'en')).toBe('9 Kartik 1433');
    expect(digits('10:42', 'bn')).toBe('১০:৪২');
    expect(timeText('15:45', 'bn', true)).toBe('৩:৪৫');
    expect(minutesOf('07:30')).toBe(450);
  });
});
