import { DomainEvent } from '../../../../core/cqrs/event-bus';
import type { VacationRequest } from '../../domain/vacation-request.entity';
import type { VacationRequestStatus } from '../../domain/vacation-request-status';

export interface VacationRequestEventPayload {
  requestId: string;
  userId: string;
  /** Who triggered the change (requester or validator). */
  actorId: string;
  startDate: string;
  endDate: string;
  status: VacationRequestStatus;
}

const snapshot = (request: VacationRequest, actorId: string): VacationRequestEventPayload => ({
  requestId: request.id,
  userId: request.userId,
  actorId,
  startDate: request.startDate,
  endDate: request.endDate,
  status: request.status,
});

export class VacationRequestSubmittedEvent extends DomainEvent<VacationRequestEventPayload> {
  readonly eventName = 'vacation-request.submitted';

  static from(request: VacationRequest): VacationRequestSubmittedEvent {
    return new VacationRequestSubmittedEvent(request.id, snapshot(request, request.userId));
  }
}

export class VacationRequestUpdatedEvent extends DomainEvent<
  VacationRequestEventPayload & { resubmitted: boolean }
> {
  readonly eventName = 'vacation-request.updated';

  static from(request: VacationRequest, resubmitted: boolean): VacationRequestUpdatedEvent {
    return new VacationRequestUpdatedEvent(request.id, {
      ...snapshot(request, request.userId),
      resubmitted,
    });
  }
}

export class VacationRequestCancelledEvent extends DomainEvent<VacationRequestEventPayload> {
  readonly eventName = 'vacation-request.cancelled';

  static from(request: VacationRequest): VacationRequestCancelledEvent {
    return new VacationRequestCancelledEvent(request.id, snapshot(request, request.userId));
  }
}

export class VacationRequestApprovedEvent extends DomainEvent<
  VacationRequestEventPayload & { comment: string | null }
> {
  readonly eventName = 'vacation-request.approved';

  static from(request: VacationRequest, validatorId: string): VacationRequestApprovedEvent {
    return new VacationRequestApprovedEvent(request.id, {
      ...snapshot(request, validatorId),
      comment: request.comments,
    });
  }
}

export class VacationRequestRejectedEvent extends DomainEvent<
  VacationRequestEventPayload & { comment: string }
> {
  readonly eventName = 'vacation-request.rejected';

  static from(request: VacationRequest, validatorId: string): VacationRequestRejectedEvent {
    return new VacationRequestRejectedEvent(request.id, {
      ...snapshot(request, validatorId),
      comment: request.comments ?? '',
    });
  }
}
