import { Query, type QueryHandler } from '../../../../core/cqrs/query-bus';
import { ValidationError } from '../../../../core/errors';
import { daysInclusive, type IsoDate } from '../../../../core/iso-date';
import type { UserRepository } from '../../../users/application/user.repository';
import { UserRole } from '../../../users/domain/user-role';
import type { VacationRequestStatus } from '../../domain/vacation-request-status';
import type { VacationRequestReadModel } from '../ports';

export const MAX_CALENDAR_RANGE_DAYS = 93;

export interface TeamMemberDto {
  id: string;
  name: string;
}

/** Deliberately minimal: colleagues see *when* someone is away, never *why*. */
export interface CalendarEntryDto {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  status: Extract<VacationRequestStatus, 'pending' | 'approved'>;
}

export interface TeamCalendarDto {
  from: string;
  to: string;
  members: TeamMemberDto[];
  entries: CalendarEntryDto[];
}

/** Team vacation planning — available to both requesters and validators. */
export class GetTeamCalendarQuery extends Query<TeamCalendarDto> {
  constructor(
    readonly from: IsoDate,
    readonly to: IsoDate,
  ) {
    super();
  }
}

export class GetTeamCalendarHandler implements QueryHandler<GetTeamCalendarQuery> {
  constructor(
    private readonly readModel: VacationRequestReadModel,
    private readonly users: UserRepository,
  ) {}

  async execute({ from, to }: GetTeamCalendarQuery): Promise<TeamCalendarDto> {
    if (to < from) {
      throw new ValidationError([{ field: 'to', message: 'Must be on or after "from"' }]);
    }
    if (daysInclusive(from, to) > MAX_CALENDAR_RANGE_DAYS) {
      throw new ValidationError([
        { field: 'to', message: `The range cannot exceed ${MAX_CALENDAR_RANGE_DAYS} days` },
      ]);
    }

    const [members, requests] = await Promise.all([
      this.users.list({ role: UserRole.REQUESTER }),
      this.readModel.findBlockingInRange(from, to),
    ]);

    return {
      from,
      to,
      members: members.map(({ id, name }) => ({ id, name })),
      entries: requests.map((request) => ({
        id: request.id,
        userId: request.userId,
        startDate: request.startDate,
        endDate: request.endDate,
        status: request.status as CalendarEntryDto['status'],
      })),
    };
  }
}
