import { randomUUID } from 'node:crypto';
import type { DomainEvent, EventPublisher } from '../../src/core/cqrs/event-bus';
import type { UnitOfWork } from '../../src/core/unit-of-work';
import type {
  UserCredentials,
  UserRepository,
} from '../../src/modules/users/application/user.repository';
import { User, type UserProps } from '../../src/modules/users/domain/user';
import { UserRole } from '../../src/modules/users/domain/user-role';
import type {
  VacationRequestRepository,
  VacationRequestsScope,
} from '../../src/modules/vacation-requests/application/ports';
import type { VacationPeriod } from '../../src/modules/vacation-requests/domain/vacation-period';
import {
  VacationRequest,
  type VacationRequestProps,
} from '../../src/modules/vacation-requests/domain/vacation-request';
import { BLOCKING_STATUSES } from '../../src/modules/vacation-requests/domain/vacation-request-status';

/** In-memory test doubles implementing the application ports — no database needed. */

const passwordHashes = new WeakMap<User, string>();

export function makeUser(
  role: UserRole,
  overrides: Partial<UserProps> & { password?: string } = {},
): User {
  const { password, ...props } = overrides;
  const user = User.restore({
    id: randomUUID(),
    name: role === UserRole.VALIDATOR ? 'Val Idator' : 'Rick Quester',
    email: `${randomUUID()}@example.com`,
    role,
    createdAt: new Date('2030-01-01T00:00:00Z'),
    ...props,
  });
  passwordHashes.set(user, password ?? 'hash');
  return user;
}

export class InMemoryUserRepository implements UserRepository {
  constructor(readonly users: User[] = []) {}

  async findById(id: string) {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    const user = this.users.find((candidate) => candidate.email === User.normalizeEmail(email));
    return user ? { user, passwordHash: passwordHashes.get(user) ?? 'hash' } : null;
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

  async add(request: VacationRequest) {
    if (this.items.has(request.id)) throw new Error(`Duplicate id ${request.id}`);
    this.items.set(request.id, request);
  }

  async save(request: VacationRequest) {
    if (!this.items.has(request.id)) throw new Error(`Unknown id ${request.id}`);
    this.items.set(request.id, request);
  }

  async remove(request: VacationRequest) {
    this.items.delete(request.id);
  }

  /** Stores a request in an arbitrary state (bypassing the creation rules and events). */
  seed(
    props: Partial<VacationRequestProps> &
      Pick<VacationRequestProps, 'userId' | 'startDate' | 'endDate'>,
  ): VacationRequest {
    const request = VacationRequest.restore({
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
