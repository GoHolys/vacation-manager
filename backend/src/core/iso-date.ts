/**
 * Calendar dates are modelled as ISO-8601 `YYYY-MM-DD` strings (PostgreSQL `date`).
 * Using plain strings instead of JS `Date` objects avoids an entire class of time-zone bugs
 * (a vacation day is a calendar day, not an instant) and keeps lexical order == chronological order.
 */
export type IsoDate = string & { readonly __brand: 'IsoDate' };

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function isIsoDate(value: string): value is IsoDate {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function asIsoDate(value: string): IsoDate {
  if (!isIsoDate(value)) {
    throw new TypeError(`"${value}" is not a valid YYYY-MM-DD date`);
  }
  return value;
}

const toUtcMs = (date: IsoDate): number => Date.parse(`${date}T00:00:00Z`);

/** Number of calendar days covered by an inclusive [start, end] range. */
export function daysInclusive(start: IsoDate, end: IsoDate): number {
  return Math.round((toUtcMs(end) - toUtcMs(start)) / MS_PER_DAY) + 1;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date(toUtcMs(date) + days * MS_PER_DAY).toISOString().slice(0, 10) as IsoDate;
}

export function toIsoDateInTimeZone(instant: Date, timeZone: string): IsoDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  return asIsoDate(`${get('year')}-${get('month')}-${get('day')}`);
}

/** Inclusive date ranges [aStart, aEnd] and [bStart, bEnd] share at least one day. */
export function rangesOverlap(aStart: IsoDate, aEnd: IsoDate, bStart: IsoDate, bEnd: IsoDate) {
  return aStart <= bEnd && bStart <= aEnd;
}
