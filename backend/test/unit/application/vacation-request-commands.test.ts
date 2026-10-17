import { beforeEach, describe, expect, it } from 'vitest';
import { FixedClock } from '../../../src/core/clock';
import { asIsoDate } from '../../../src/core/iso-date';
import type { User } from '../../../src/modules/users/domain/user.entity';
import { UserRole } from '../../../src/modules/users/domain/user-role';
import {
  ApproveVacationRequestCommand,
  ApproveVacationRequestHandler,
} from '../../../src/modules/vacation-requests/application/commands/approve-vacation-request.command';
import {
  CancelVacationRequestCommand,
  CancelVacationRequestHandler,
} from '../../../src/modules/vacation-requests/application/commands/cancel-vacation-request.command';
import {
  CreateVacationRequestCommand,
  CreateVacationRequestHandler,
} from '../../../src/modules/vacation-requests/application/commands/create-vacation-request.command';
import type { VacationRequestCommandDependencies } from '../../../src/modules/vacation-requests/application/commands/dependencies';
import {
  RejectVacationRequestCommand,
  RejectVacationRequestHandler,
} from '../../../src/modules/vacation-requests/application/commands/reject-vacation-request.command';
import {
  UpdateVacationRequestCommand,
  UpdateVacationRequestHandler,
} from '../../../src/modules/vacation-requests/application/commands/update-vacation-request.command';
import {
  InMemoryUnitOfWork,
  InMemoryUserRepository,
  InMemoryVacationRequestRepository,
  makeUser,
  RecordingEventPublisher,
} from '../../support/in-memory';

const d = asIsoDate;

describe('vacation request command handlers', () => {
  let requester: User;
  let otherRequester: User;
  let validator: User;
  let requests: InMemoryVacationRequestRepository;
  let events: RecordingEventPublisher;
  let deps: VacationRequestCommandDependencies;

  beforeEach(() => {
    requester = makeUser(UserRole.REQUESTER);
    otherRequester = makeUser(UserRole.REQUESTER);
    validator = makeUser(UserRole.VALIDATOR);
    requests = new InMemoryVacationRequestRepository();
    events = new RecordingEventPublisher();
    deps = {
      unitOfWork: new InMemoryUnitOfWork({
        vacationRequests: requests,
        users: new InMemoryUserRepository([requester, otherRequester, validator]),
      }),
      events,
      clock: new FixedClock(new Date('2030-01-15T10:00:00Z')),
    };
  });

  describe('CreateVacationRequest', () => {
    const create = (userId: string, start: string, end: string, reason?: string) =>
      new CreateVacationRequestHandler(deps).execute(
        new CreateVacationRequestCommand(userId, start, end, reason),
      );

    it('creates a pending request and publishes VacationRequestSubmitted', async () => {
      const { id } = await create(requester.id, '2030-02-01', '2030-02-05', 'Ski');

      expect(requests.items.get(id)).toMatchObject({ status: 'pending', reason: 'Ski' });
      expect(events.names()).toEqual(['vacation-request.submitted']);
      expect(events.published[0]?.payload).toMatchObject({ requestId: id, actorId: requester.id });
    });

    it('rule #2 — refuses overlapping pending/approved requests of the same user', async () => {
      requests.add({ userId: requester.id, startDate: d('2030-02-01'), endDate: d('2030-02-05') });

      await expect(create(requester.id, '2030-02-05', '2030-02-10')).rejects.toMatchObject({
        code: 'VACATION_OVERLAP',
        status: 409,
      });
      expect(events.published).toHaveLength(0);
    });

    it('allows overlapping a rejected request or another user’s request', async () => {
      requests.add({
        userId: requester.id,
        startDate: d('2030-02-01'),
        endDate: d('2030-02-05'),
        status: 'rejected',
        comments: 'no',
      });
      requests.add({
        userId: otherRequester.id,
        startDate: d('2030-02-01'),
        endDate: d('2030-02-05'),
      });

      await expect(create(requester.id, '2030-02-01', '2030-02-05')).resolves.toHaveProperty('id');
    });

    it('rules #1 and #4 — validates the period', async () => {
      await expect(create(requester.id, '2030-02-05', '2030-02-05')).rejects.toMatchObject({
        code: 'END_DATE_NOT_AFTER_START_DATE',
      });
      await expect(create(requester.id, '2030-01-14', '2030-01-20')).rejects.toMatchObject({
        code: 'START_DATE_IN_PAST',
      });
    });

    it('only requesters can submit requests', async () => {
      await expect(create(validator.id, '2030-02-01', '2030-02-05')).rejects.toMatchObject({
        code: 'REQUESTER_ROLE_REQUIRED',
        status: 403,
      });
    });
  });

  describe('UpdateVacationRequest', () => {
    const update = (actorId: string, requestId: string, start: string, end: string) =>
      new UpdateVacationRequestHandler(deps).execute(
        new UpdateVacationRequestCommand(actorId, requestId, start, end, 'updated'),
      );

    it('reschedules a pending request', async () => {
      const request = requests.add({
        userId: requester.id,
        startDate: d('2030-02-01'),
        endDate: d('2030-02-05'),
      });

      const result = await update(requester.id, request.id, '2030-02-02', '2030-02-06');

      expect(result).toEqual({ id: request.id, resubmitted: false });
      expect(request).toMatchObject({
        startDate: '2030-02-02',
        endDate: '2030-02-06',
        reason: 'updated',
      });
      expect(events.names()).toEqual(['vacation-request.updated']);
    });

    it('does not count the request itself as an overlap', async () => {
      const request = requests.add({
        userId: requester.id,
        startDate: d('2030-02-01'),
        endDate: d('2030-02-05'),
      });
      await expect(
        update(requester.id, request.id, '2030-02-03', '2030-02-07'),
      ).resolves.toBeDefined();
    });

    it('rule #3 — refuses to modify an approved request', async () => {
      const request = requests.add({
        userId: requester.id,
        startDate: d('2030-02-01'),
        endDate: d('2030-02-05'),
        status: 'approved',
      });
      await expect(
        update(requester.id, request.id, '2030-02-02', '2030-02-06'),
      ).rejects.toMatchObject({
        code: 'REQUEST_NOT_MODIFIABLE',
      });
    });

    it('re-submits a rejected request', async () => {
      const request = requests.add({
        userId: requester.id,
        startDate: d('2030-02-01'),
        endDate: d('2030-02-05'),
        status: 'rejected',
        comments: 'busy',
      });
      await expect(
        update(requester.id, request.id, '2030-03-01', '2030-03-03'),
      ).resolves.toMatchObject({
        resubmitted: true,
      });
      expect(request.status).toBe('pending');
    });

    it('refuses to modify someone else’s request', async () => {
      const request = requests.add({
        userId: otherRequester.id,
        startDate: d('2030-02-01'),
        endDate: d('2030-02-05'),
      });
      await expect(
        update(requester.id, request.id, '2030-02-02', '2030-02-06'),
      ).rejects.toMatchObject({
        code: 'NOT_REQUEST_OWNER',
        status: 403,
      });
    });
  });

  describe('CancelVacationRequest', () => {
    const cancel = (actorId: string, requestId: string) =>
      new CancelVacationRequestHandler(deps).execute(
        new CancelVacationRequestCommand(actorId, requestId),
      );

    it('deletes a pending request and publishes VacationRequestCancelled', async () => {
      const request = requests.add({
        userId: requester.id,
        startDate: d('2030-02-01'),
        endDate: d('2030-02-05'),
      });
      await cancel(requester.id, request.id);
      expect(requests.items.has(request.id)).toBe(false);
      expect(events.names()).toEqual(['vacation-request.cancelled']);
      expect(events.published[0]?.aggregateId).toBe(request.id);
    });

    it('refuses to cancel an approved request', async () => {
      const request = requests.add({
        userId: requester.id,
        startDate: d('2030-02-01'),
        endDate: d('2030-02-05'),
        status: 'approved',
      });
      await expect(cancel(requester.id, request.id)).rejects.toMatchObject({
        code: 'REQUEST_NOT_MODIFIABLE',
      });
      expect(requests.items.has(request.id)).toBe(true);
    });
  });

  describe('Approve / Reject', () => {
    const approve = (actorId: string, requestId: string, comment?: string) =>
      new ApproveVacationRequestHandler(deps).execute(
        new ApproveVacationRequestCommand(actorId, requestId, comment),
      );
    const reject = (actorId: string, requestId: string, comment: string) =>
      new RejectVacationRequestHandler(deps).execute(
        new RejectVacationRequestCommand(actorId, requestId, comment),
      );

    it('a validator approves a pending request', async () => {
      const request = requests.add({
        userId: requester.id,
        startDate: d('2030-02-01'),
        endDate: d('2030-02-05'),
      });
      await approve(validator.id, request.id, 'Enjoy');
      expect(request).toMatchObject({
        status: 'approved',
        comments: 'Enjoy',
        decidedById: validator.id,
      });
      expect(events.names()).toEqual(['vacation-request.approved']);
      expect(events.published[0]?.payload).toMatchObject({
        actorId: validator.id,
        comment: 'Enjoy',
      });
    });

    it('rule #6 — requesters cannot approve or reject', async () => {
      const request = requests.add({
        userId: otherRequester.id,
        startDate: d('2030-02-01'),
        endDate: d('2030-02-05'),
      });
      await expect(approve(requester.id, request.id)).rejects.toMatchObject({
        code: 'VALIDATOR_ROLE_REQUIRED',
        status: 403,
      });
      await expect(reject(requester.id, request.id, 'no')).rejects.toMatchObject({
        code: 'VALIDATOR_ROLE_REQUIRED',
      });
      expect(request.status).toBe('pending');
    });

    it('rule #5 — a rejection requires a comment', async () => {
      const request = requests.add({
        userId: requester.id,
        startDate: d('2030-02-01'),
        endDate: d('2030-02-05'),
      });
      await expect(reject(validator.id, request.id, '')).rejects.toMatchObject({
        code: 'REJECTION_COMMENT_REQUIRED',
      });
      await reject(validator.id, request.id, 'Team offsite');
      expect(request).toMatchObject({ status: 'rejected', comments: 'Team offsite' });
      expect(events.names()).toEqual(['vacation-request.rejected']);
    });

    it('returns 404 for unknown requests', async () => {
      await expect(
        approve(validator.id, '00000000-0000-4000-8000-000000000000'),
      ).rejects.toMatchObject({
        code: 'VACATION_REQUEST_NOT_FOUND',
        status: 404,
      });
    });
  });
});
