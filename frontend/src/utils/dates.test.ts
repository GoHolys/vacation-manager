import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysInclusive,
  daysOfMonth,
  formatRange,
  isMonth,
  monthBounds,
  shiftMonth,
  workingDays,
} from './dates';

describe('date utilities', () => {
  it('does calendar arithmetic without time-zone drift', () => {
    expect(addDays('2030-02-28', 1)).toBe('2030-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(daysInclusive('2030-03-25', '2030-04-02')).toBe(9);
  });

  it('counts working days (Mon–Fri)', () => {
    // Fri 1 Feb 2030 → Mon 4 Feb 2030
    expect(workingDays('2030-02-01', '2030-02-04')).toBe(2);
    expect(workingDays('2030-02-02', '2030-02-03')).toBe(0);
  });

  it('formats ranges compactly', () => {
    expect(formatRange('2030-02-04', '2030-02-08')).toBe('Mon 4 Feb – Fri 8 Feb 2030');
    expect(formatRange('2030-12-30', '2031-01-02')).toBe('Mon 30 Dec 2030 – Thu 2 Jan 2031');
  });

  it('handles months', () => {
    expect(isMonth('2030-02')).toBe(true);
    expect(isMonth('2030-13')).toBe(false);
    expect(shiftMonth('2030-01', -1)).toBe('2029-12');
    expect(shiftMonth('2030-12', 1)).toBe('2031-01');
    expect(monthBounds('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(daysOfMonth('2030-04')).toHaveLength(30);
  });
});
