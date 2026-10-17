import { describe, expect, it } from 'vitest';
import { asIsoDate } from '../../../src/core/iso-date';
import { VacationPeriod } from '../../../src/modules/vacation-requests/domain/vacation-period';
import { VacationRequest } from '../../../src/modules/vacation-requests/domain/vacation-request.entity';

const TODAY = asIsoDate('2030-01-15');
const NOW = new Date('2030-01-15T10:00:00Z');
const period = (start: string, end: string) => VacationPeriod.create(start, end, TODAY);
const newRequest = () =>
  VacationRequest.submit({
    userId: 'user-1',
    period: period('2030-02-01', '2030-02-05'),
    reason: '  Trip  ',
  });

describe('VacationPeriod', () => {
  it('accepts a period starting today', () => {
    const value = period('2030-01-15', '2030-01-16');
    expect(value.days).toBe(2);
  });

  it('rule #1 — rejects an end date that is not after the start date', () => {
    expect(() => period('2030-02-05', '2030-02-05')).toThrow(
      expect.objectContaining({ code: 'END_DATE_NOT_AFTER_START_DATE', status: 422 }),
    );
    expect(() => period('2030-02-05', '2030-02-01')).toThrow(
      expect.objectContaining({ code: 'END_DATE_NOT_AFTER_START_DATE' }),
    );
  });

  it('rule #4 — rejects a period starting in the past', () => {
    expect(() => period('2030-01-14', '2030-01-20')).toThrow(
      expect.objectContaining({ code: 'START_DATE_IN_PAST', status: 422 }),
    );
  });

  it('rejects malformed dates', () => {
    expect(() => period('2030-02-30', '2030-03-01')).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });

  it('detects overlaps including touching boundaries', () => {
    const a = period('2030-02-01', '2030-02-05');
    expect(a.overlaps(period('2030-02-05', '2030-02-08'))).toBe(true);
    expect(a.overlaps(period('2030-02-06', '2030-02-08'))).toBe(false);
  });
});

describe('VacationRequest aggregate', () => {
  it('is submitted as pending with a normalised reason', () => {
    const request = newRequest();
    expect(request.status).toBe('pending');
    expect(request.reason).toBe('Trip');
    expect(request.decidedById).toBeNull();
  });

  it('can be approved with an optional comment', () => {
    const request = newRequest();
    request.approve('validator-1', '', NOW);
    expect(request.status).toBe('approved');
    expect(request.comments).toBeNull();
    expect(request.decidedById).toBe('validator-1');
    expect(request.decidedAt).toEqual(NOW);
  });

  it('rule #5 — cannot be rejected without a comment', () => {
    const request = newRequest();
    expect(() => request.reject('validator-1', '   ', NOW)).toThrow(
      expect.objectContaining({ code: 'REJECTION_COMMENT_REQUIRED' }),
    );
    expect(request.status).toBe('pending');

    request.reject('validator-1', ' Busy week ', NOW);
    expect(request.status).toBe('rejected');
    expect(request.comments).toBe('Busy week');
  });

  it('can only be decided once', () => {
    const request = newRequest();
    request.approve('validator-1', null, NOW);
    expect(() => request.reject('validator-1', 'no', NOW)).toThrow(
      expect.objectContaining({ code: 'REQUEST_ALREADY_DECIDED', status: 409 }),
    );
  });

  it('rule #3 — approved requests cannot be modified', () => {
    const request = newRequest();
    request.approve('validator-1', null, NOW);
    expect(() => request.reschedule(period('2030-03-01', '2030-03-02'))).toThrow(
      expect.objectContaining({ code: 'REQUEST_NOT_MODIFIABLE', status: 409 }),
    );
    expect(() => request.assertModifiable()).toThrow();
  });

  it('rescheduling a rejected request re-submits it for review', () => {
    const request = newRequest();
    request.reject('validator-1', 'Busy week', NOW);

    const { resubmitted } = request.reschedule(period('2030-03-01', '2030-03-04'), 'New dates');

    expect(resubmitted).toBe(true);
    expect(request).toMatchObject({
      status: 'pending',
      comments: null,
      decidedById: null,
      decidedAt: null,
      startDate: '2030-03-01',
      endDate: '2030-03-04',
      reason: 'New dates',
    });
  });

  it('rescheduling a pending request keeps it pending', () => {
    const request = newRequest();
    expect(request.reschedule(period('2030-03-01', '2030-03-04')).resubmitted).toBe(false);
    expect(request.status).toBe('pending');
  });
});
