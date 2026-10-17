import { randomUUID } from 'node:crypto';
import type { DomainEvent, EventPublisher } from '../../src/core/cqrs/event-bus';
import type { UnitOfWork } from '../../src/core/unit-of-work';
import type { UserRepository } from '../../src/modules/users/application/user.repository';
import { User } from '../../src/modules/users/domain/user.entity';
import { UserRole } from '../../src/modules/users/domain/user-role';
import type {
  VacationRequestRepository,
  VacationRequestsScope,
} from '../../src/modules/vacation-requests/application/ports';
import type { VacationPeriod } from '../../src/modules/vacation-requests/domain/vacation-period';
import { VacationRequest } from '../../src/modules/vacation-requests/domain/vacation-request.entity';
import { BLOCKING_STATUSES } from '../../src/modules/vacation-requests/domain/vacation-request-status';

/** In-memory test doubles implementing the application ports — no database needed. */

export function makeUser(role: UserRole, overrides: Partial<User> = {}): User {
  return Object.assign(new User(), {
    id: randomUUID(),
    name: role === UserRole.VALIDATOR ? 'Val Idator' : 'Rick Quester',
    email: `${randomUUID()}@example.com`,
    password: 'hash',
    role,
    createdAt: new Date('2030-01-01T00:00:00Z'),
    ...overrides,
  });
}

export class InMemoryUserRepository implements UserRepository {
  constructor(readonly users: User[] = []) {}

  async findById(id: string) {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async findByEmailWithPassword(email: string) {
    return this.users.find((user) => user.email === User.normalizeEmail(email)) ?? null;
  }

  async list(filter: { role?: UserRole } = {}) {
    return this.users.filter((user) => !filter.role || user.role === filter.role);
  }
}

export class InMemoryVacationRequestRepository implements VacationRequestRepository {
  readonly items = new Map<string, VacationRequest>();

  async findById(id: string) {
    return this.items.get(id) ?? null;
  }

  async findOverlapping(userId: string, period: VacationPeriod, excludeRequestId?: string) {
    return [...this.items.values()].filter(
      (request) =>
        request.userId === userId &&
        request.id !== excludeRequestId &&
        BLOCKING_STATUSES.includes(request.status) &&
        request.period.overlaps(period),
    );
  }

  async save(request: VacationRequest) {
    request.id ??= randomUUID();
    request.createdAt ??= new Date();
    request.updatedAt = new Date();
    this.items.set(request.id, request);
    return request;
  }

  async remove(request: VacationRequest) {
    this.items.delete(request.id);
  }

  /** Seeds a request in an arbitrary state (bypassing the creation rules). */
  add(props: Partial<VacationRequest> & Pick<VacationRequest, 'userId' | 'startDate' | 'endDate'>) {
    const request = Object.assign(new VacationRequest(), {
      id: randomUUID(),
      reason: null,
      status: 'pending',
      comments: null,
      decidedById: null,
      decidedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...props,
    });
    this.items.set(request.id, request);
    return request;
  }
}

export class InMemoryUnitOfWork implements UnitOfWork<VacationRequestsScope> {
  constructor(readonly scope: VacationRequestsScope) {}

  run<T>(work: (scope: VacationRequestsScope) => Promise<T>): Promise<T> {
    return work(this.scope);
  }
}

export class RecordingEventPublisher implements EventPublisher {
  readonly published: DomainEvent[] = [];

  async publish(...events: DomainEvent[]): Promise<void> {
    this.published.push(...events);
  }

  names(): string[] {
    return this.published.map((event) => event.eventName);
  }
}
