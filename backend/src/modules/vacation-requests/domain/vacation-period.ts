import { daysInclusive, type IsoDate, isIsoDate, rangesOverlap } from '../../../core/iso-date';
import { VacationRequestErrors } from './vacation-request.errors';

/**
 * Value object for an inclusive [startDate, endDate] calendar range.
 * It can only be constructed in a valid state, so every place holding a
 * `VacationPeriod` is guaranteed to satisfy business rules #1 and #4.
 */
export class VacationPeriod {
  private constructor(
    readonly startDate: IsoDate,
    readonly endDate: IsoDate,
  ) {}

  /**
   * Creates a period for a *new or rescheduled* request.
   * @param today the current calendar date in the application time zone.
   */
  static create(startDate: string, endDate: string, today: IsoDate): VacationPeriod {
    if (!isIsoDate(startDate)) throw VacationRequestErrors.invalidDate('startDate', startDate);
    if (!isIsoDate(endDate)) throw VacationRequestErrors.invalidDate('endDate', endDate);

    // Rule #1 — end date must be after start date.
    if (endDate <= startDate) throw VacationRequestErrors.endDateNotAfterStartDate();
    // Rule #4 — requests in the past are not allowed (today is allowed).
    if (startDate < today) throw VacationRequestErrors.startDateInPast();

    return new VacationPeriod(startDate, endDate);
  }

  /** Rehydrates an already-persisted period without re-applying creation-time rules. */
  static restore(startDate: IsoDate, endDate: IsoDate): VacationPeriod {
    return new VacationPeriod(startDate, endDate);
  }

  get days(): number {
    return daysInclusive(this.startDate, this.endDate);
  }

  overlaps(other: VacationPeriod): boolean {
    return rangesOverlap(this.startDate, this.endDate, other.startDate, other.endDate);
  }
}
