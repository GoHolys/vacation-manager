import { type IsoDate, toIsoDateInTimeZone } from './iso-date';

/** Abstracts "now" so time-dependent business rules are deterministic in tests. */
export interface Clock {
  now(): Date;
  /** Today's calendar date in the application time zone. */
  today(): IsoDate;
}

export class SystemClock implements Clock {
  constructor(private readonly timeZone: string) {}

  now(): Date {
    return new Date();
  }

  today(): IsoDate {
    return toIsoDateInTimeZone(this.now(), this.timeZone);
  }
}

export class FixedClock implements Clock {
  constructor(private instant: Date) {}

  now(): Date {
    return new Date(this.instant);
  }

  today(): IsoDate {
    return toIsoDateInTimeZone(this.instant, 'UTC');
  }

  set(instant: Date): void {
    this.instant = instant;
  }
}
