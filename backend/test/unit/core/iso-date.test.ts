import { describe, expect, it } from 'vitest';
import {
  addDays,
  asIsoDate,
  daysInclusive,
  isIsoDate,
  rangesOverlap,
  toIsoDateInTimeZone,
} from '../../../src/core/iso-date';

const d = asIsoDate;

describe('iso-date', () => {
  it.each(['2030-01-01', '2028-02-29', '2030-12-31'])('accepts the valid date %s', (value) => {
    expect(isIsoDate(value)).toBe(true);
  });

  it.each(['2030-02-29', '2030-13-01', '2030-04-31', '30-01-01', '2030-1-1', '', 'tomorrow'])(
    'rejects the invalid date "%s"',
    (value) => {
      expect(isIsoDate(value)).toBe(false);
    },
  );

  it('counts calendar days inclusively', () => {
    expect(daysInclusive(d('2030-01-01'), d('2030-01-01'))).toBe(1);
    expect(daysInclusive(d('2030-01-01'), d('2030-01-05'))).toBe(5);
    // Across a DST change in many time zones — must not be off by one.
    expect(daysInclusive(d('2030-03-25'), d('2030-04-02'))).toBe(9);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays(d('2030-01-31'), 1)).toBe('2030-02-01');
    expect(addDays(d('2030-12-31'), 1)).toBe('2031-01-01');
    expect(addDays(d('2030-03-01'), -1)).toBe('2030-02-28');
  });

  it('resolves "today" in the configured time zone', () => {
    const instant = new Date('2030-06-30T22:30:00Z');
    expect(toIsoDateInTimeZone(instant, 'UTC')).toBe('2030-06-30');
    expect(toIsoDateInTimeZone(instant, 'Asia/Jerusalem')).toBe('2030-07-01');
    expect(toIsoDateInTimeZone(instant, 'America/New_York')).toBe('2030-06-30');
  });

  it('detects overlapping inclusive ranges', () => {
    expect(rangesOverlap(d('2030-01-01'), d('2030-01-05'), d('2030-01-05'), d('2030-01-09'))).toBe(
      true,
    );
    expect(rangesOverlap(d('2030-01-01'), d('2030-01-05'), d('2030-01-02'), d('2030-01-03'))).toBe(
      true,
    );
    expect(rangesOverlap(d('2030-01-01'), d('2030-01-05'), d('2030-01-06'), d('2030-01-09'))).toBe(
      false,
    );
  });
});
