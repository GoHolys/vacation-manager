import { describe, expect, it } from 'vitest';
import { asIsoDate } from '../../../src/core/iso-date';
import { VacationPeriod } from '../../../src/modules/vacation-requests/domain/vacation-period';
import { VacationRequest } from '../../../src/modules/vacation-requests/domain/vacation-request';

const TODAY = asIsoDate('2030-01-15');
const NOW = new Date('2030-01-15T10:00:00Z');
const period = (start: string, end: string) => VacationPeriod.create(start, end, TODAY);
const newRequest = () =>
  VacationRequest.submit(
    { userId: 'user-1', period: period('2030-02-01', '2030-02-05'), reason: '  Trip  ' },
    NOW,
  );

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
    expect(() => request.reschedule(period('2030-03-01', '2030-03-02'), null, NOW)).toThrow(
      expect.objectContaining({ code: 'REQUEST_NOT_MODIFIABLE', status: 409 }),
    );
    expect(() => request.assertModifiable()).toThrow();
  });

  it('rescheduling a rejected request re-submits it for review', () => {
    const request = newRequest();
    request.reject('validator-1', 'Busy week', NOW);

    const { resubmitted } = request.reschedule(
      period('2030-03-01', '2030-03-04'),
      'New dates',
      NOW,
    );

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
    expect(request.reschedule(period('2030-03-01', '2030-03-04'), null, NOW).resubmitted).toBe(
      false,
    );
    expect(request.status).toBe('pending');
  });

  it('enforces the maximum length of the reason and the comment', () => {
    expect(() =>
      VacationRequest.submit(
        { userId: 'user-1', period: period('2030-02-01', '2030-02-05'), reason: 'x'.repeat(501) },
        NOW,
      ),
    ).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(() => newRequest().reject('validator-1', 'x'.repeat(1001), NOW)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });

  it('can be cancelled unless approved', () => {
    const approved = newRequest();
    approved.approve('validator-1', null, NOW);
    expect(() => approved.cancel()).toThrow(
      expect.objectContaining({ code: 'REQUEST_NOT_MODIFIABLE' }),
    );
    expect(() => newRequest().cancel()).not.toThrow();
  });
});

describe('VacationRequest domain events', () => {
  it('records VacationRequestSubmittedEvent when submitted', () => {
    const request = newRequest();
    const events = request.pullEvents();

    expect(events.map((event) => event.eventName)).toEqual(['vacation-request.submitted']);
    expect(events[0]).toMatchObject({
      aggregateId: request.id,
      payload: {
        requestId: request.id,
        userId: 'user-1',
        actorId: 'user-1',
        startDate: '2030-02-01',
        endDate: '2030-02-05',
        status: 'pending',
        reason: 'Trip',
      },
    });
    expect(events[0]?.eventId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('pullEvents returns each event once', () => {
    const request = newRequest();
    expect(request.pullEvents()).toHaveLength(1);
    expect(request.pullEvents()).toHaveLength(0);
  });

  it('records one event per state change, attributed to the right actor', () => {
    const request = newRequest();
    request.reject('validator-1', 'Busy week', NOW);
    request.reschedule(period('2030-03-01', '2030-03-04'), 'New dates', NOW);
    request.approve('validator-2', 'Enjoy', NOW);

    const events = request.pullEvents();
    expect(events.map((event) => event.eventName)).toEqual([
      'vacation-request.submitted',
      'vacation-request.rejected',
      'vacation-request.updated',
      'vacation-request.approved',
    ]);
    expect(events[1]?.payload).toMatchObject({ actorId: 'validator-1', comment: 'Busy week' });
    expect(events[2]?.payload).toMatchObject({
      actorId: 'user-1',
      resubmitted: true,
      previous: { startDate: '2030-02-01', endDate: '2030-02-05', reason: 'Trip' },
    });
    expect(events[3]?.payload).toMatchObject({ actorId: 'validator-2', status: 'approved' });
  });

  it('records VacationRequestCancelledEvent when withdrawn', () => {
    const request = newRequest();
    request.pullEvents();
    request.cancel();
    expect(request.pullEvents().map((event) => event.eventName)).toEqual([
      'vacation-request.cancelled',
    ]);
  });

  it('records nothing when a rule rejects the change', () => {
    const request = newRequest();
    request.pullEvents();
    expect(() => request.reject('validator-1', '  ', NOW)).toThrow();
    expect(request.pullEvents()).toHaveLength(0);
  });

  it('is rebuilt from stored state without recording events', () => {
    const restored = VacationRequest.restore(newRequest().snapshot());
    expect(restored.pullEvents()).toHaveLength(0);
    expect(restored.status).toBe('pending');
  });
});
