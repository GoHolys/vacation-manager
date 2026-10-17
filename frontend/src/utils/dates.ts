/**
 * Calendar-date helpers. Dates travel as ISO `YYYY-MM-DD` strings (like the API) and are only
 * turned into `Date` objects at UTC midnight for arithmetic and formatting, avoiding time-zone drift.
 */
const MS_PER_DAY = 86_400_000;
const LOCALE = 'en-GB';

const toUtc = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
const toIso = (date: Date): string => date.toISOString().slice(0, 10);

/** Today's date in the user's local time zone. */
export function todayIso(now: Date = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return toIso(local);
}

export function addDays(iso: string, days: number): string {
  return toIso(new Date(toUtc(iso).getTime() + days * MS_PER_DAY));
}

export function daysInclusive(start: string, end: string): number {
  return Math.round((toUtc(end).getTime() - toUtc(start).getTime()) / MS_PER_DAY) + 1;
}

export function isWeekend(iso: string): boolean {
  const day = toUtc(iso).getUTCDay();
  return day === 0 || day === 6;
}

/** Monday–Friday days in an inclusive range. */
export function workingDays(start: string, end: string): number {
  let count = 0;
  for (let day = start; day <= end; day = addDays(day, 1)) if (!isWeekend(day)) count++;
  return count;
}

const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', ...options });

const partsFormat = fmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Assembled from parts rather than `format()` so the output is identical across ICU versions
 * (browsers and Node disagree on commas such as "Fri, 8 Feb" vs "Fri 8 Feb").
 */
function dateParts(iso: string) {
  const parts = partsFormat.formatToParts(toUtc(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return { weekday: get('weekday'), day: get('day'), month: get('month'), year: get('year') };
}

const dayMonth = {
  format: (iso: string) => {
    const p = dateParts(iso);
    return `${p.weekday} ${p.day} ${p.month}`;
  },
};
const dayMonthYear = { format: (iso: string) => `${dayMonth.format(iso)} ${dateParts(iso).year}` };
const shortDate = {
  format: (iso: string) => {
    const p = dateParts(iso);
    return `${p.day} ${p.month} ${p.year}`;
  },
};
const monthYear = fmt({ month: 'long', year: 'numeric' });
const weekdayLetter = fmt({ weekday: 'narrow' });

/** "Mon 3 Feb – Fri 7 Feb 2030" (year shown once when both dates share it). */
export function formatRange(start: string, end: string): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const from = (sameYear ? dayMonth : dayMonthYear).format(start);
  return `${from} – ${dayMonthYear.format(end)}`;
}

export const formatDate = (iso: string): string => shortDate.format(iso);
export const formatLongDate = (iso: string): string => dayMonthYear.format(iso);
export const weekdayInitial = (iso: string): string => weekdayLetter.format(toUtc(iso));

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

/** "today", "yesterday", "3 days ago", then a plain date after a month. */
export function formatRelative(isoDateTime: string, now: Date = new Date()): string {
  const days = Math.round(
    (toUtc(todayIso(new Date(isoDateTime))).getTime() - toUtc(todayIso(now)).getTime()) /
      MS_PER_DAY,
  );
  if (Math.abs(days) < 30) return relative.format(days, 'day');
  return formatDate(todayIso(new Date(isoDateTime)));
}

// ─── Months (YYYY-MM) ─────────────────────────────────────────────────────────

export const currentMonth = (now: Date = new Date()): string => todayIso(now).slice(0, 7);

export const isMonth = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number) as [number, number];
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return toIso(date).slice(0, 7);
}

export function monthBounds(month: string): { from: string; to: string } {
  const from = `${month}-01`;
  return { from, to: addDays(`${shiftMonth(month, 1)}-01`, -1) };
}

export function daysOfMonth(month: string): string[] {
  const { from, to } = monthBounds(month);
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

export const formatMonth = (month: string): string => monthYear.format(toUtc(`${month}-01`));
