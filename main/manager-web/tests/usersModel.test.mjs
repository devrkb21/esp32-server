import { describe, expect, it, vi } from 'vitest';
import {
  batchOutcome, callWithTimeout, createdText, hasInvalidId, isActive, isSuperAdmin, pageAfterDelete, parseCreated,
} from '@/views/users/usersModel.js';

describe('users model', () => {
  it('reads the API date format as local time', () => {
    const d = parseCreated('2026-03-14 10:22:05');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 2, 14, 10, 22]);
    expect(parseCreated('')).toBeNull();
    expect(parseCreated('not a date')).toBeNull();
  });
  it('writes the registration date in the page language', () => {
    expect(createdText('2026-03-14 10:22:05', 'en')).toEqual({ date: '14 Mar 2026', time: '10:22' });
    const bn = createdText('2026-03-14 10:22:05', 'bn');
    expect(bn.time).toBe('১০:২২');
    expect(bn.date).toMatch(/১৪/);
    expect(createdText(null, 'en')).toEqual({ date: '', time: '' });
  });
  it('flags ids that are not numbers, as the legacy guard did', () => {
    expect(hasInvalidId(['1001', '1002'])).toBe(false);
    expect(hasInvalidId(['1001', 'abc'])).toBe(true);
    expect(hasInvalidId([''])).toBe(true);
  });
  it('steps back a page when the last row of the last page is deleted', () => {
    expect(pageAfterDelete(3, 10, 21, 1)).toBe(2);
    expect(pageAfterDelete(3, 10, 25, 1)).toBe(3);
    expect(pageAfterDelete(1, 10, 1, 1)).toBe(1);
    expect(pageAfterDelete(5, 10, 45, 5)).toBe(4);
  });
  it('sums up a batch', () => {
    expect(batchOutcome([{ success: true }, { success: true }])).toEqual({ ok: 2, fail: 0, kind: 'all' });
    expect(batchOutcome([{ success: false }])).toEqual({ ok: 0, fail: 1, kind: 'none' });
    expect(batchOutcome([{ success: true }, { success: false }])).toEqual({ ok: 1, fail: 1, kind: 'some' });
  });
  it('resolves a callback call, or null when it never calls back', async () => {
    await expect(callWithTimeout((cb) => cb('yes'))).resolves.toBe('yes');
    vi.useFakeTimers();
    const p = callWithTimeout(() => {}, 50);
    vi.advanceTimersByTime(60);
    await expect(p).resolves.toBeNull();
    vi.useRealTimers();
  });
  it('reads status and super admin flags', () => {
    expect(isActive({ status: 1 })).toBe(true);
    expect(isActive({ status: 0 })).toBe(false);
    expect(isSuperAdmin({ superAdmin: 1 })).toBe(true);
    expect(isSuperAdmin({})).toBe(false);
  });
});
