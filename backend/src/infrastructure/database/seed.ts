import bcrypt from 'bcryptjs';
import type { DataSource } from 'typeorm';
import { addDays, type IsoDate } from '../../core/iso-date';
import { User } from '../../modules/users/domain/user.entity';
import { UserRole } from '../../modules/users/domain/user-role';
import { VacationRequest } from '../../modules/vacation-requests/domain/vacation-request.entity';
import {
  VacationRequestStatus,
  type VacationRequestStatus as Status,
} from '../../modules/vacation-requests/domain/vacation-request-status';

export const DEMO_PASSWORD = 'Password123!';

interface SeedUser {
  key: string;
  name: string;
  email: string;
  role: UserRole;
}

const USERS: SeedUser[] = [
  {
    key: 'olivia',
    name: 'Olivia Bennett',
    email: 'validator@example.com',
    role: UserRole.VALIDATOR,
  },
  {
    key: 'marcus',
    name: 'Marcus Reid',
    email: 'marcus.reid@example.com',
    role: UserRole.VALIDATOR,
  },
  { key: 'liam', name: 'Liam Carter', email: 'requester@example.com', role: UserRole.REQUESTER },
  { key: 'emma', name: 'Emma Rossi', email: 'emma.rossi@example.com', role: UserRole.REQUESTER },
  { key: 'noah', name: 'Noah Levi', email: 'noah.levi@example.com', role: UserRole.REQUESTER },
  { key: 'yuki', name: 'Yuki Tanaka', email: 'yuki.tanaka@example.com', role: UserRole.REQUESTER },
  {
    key: 'sofia',
    name: 'Sofia Martins',
    email: 'sofia.martins@example.com',
    role: UserRole.REQUESTER,
  },
  { key: 'daniel', name: 'Daniel Mor', email: 'daniel.mor@example.com', role: UserRole.REQUESTER },
];

interface SeedRequest {
  user: string;
  /** Offsets in days relative to "today". */
  from: number;
  to: number;
  status: Status;
  reason?: string;
  comment?: string;
  decidedBy?: string;
  /** Days before today the request was created. */
  createdDaysAgo: number;
}

const { PENDING, APPROVED, REJECTED } = VacationRequestStatus;

const REQUESTS: SeedRequest[] = [
  // Liam (demo requester) — one of each status
  {
    user: 'liam',
    from: -30,
    to: -26,
    status: APPROVED,
    reason: 'Long weekend in Lisbon',
    decidedBy: 'olivia',
    createdDaysAgo: 50,
  },
  { user: 'liam', from: 10, to: 14, status: PENDING, reason: 'Family trip', createdDaysAgo: 3 },
  {
    user: 'liam',
    from: 40,
    to: 45,
    status: REJECTED,
    reason: 'Ski week',
    comment: 'This overlaps the Q4 release freeze — could you move it a week later?',
    decidedBy: 'olivia',
    createdDaysAgo: 6,
  },
  {
    user: 'liam',
    from: 60,
    to: 62,
    status: PENDING,
    reason: 'Moving apartments',
    createdDaysAgo: 1,
  },
  // Team
  {
    user: 'emma',
    from: -60,
    to: -55,
    status: APPROVED,
    reason: 'Summer holiday',
    decidedBy: 'marcus',
    createdDaysAgo: 90,
  },
  {
    user: 'emma',
    from: 3,
    to: 9,
    status: APPROVED,
    reason: 'Sister’s wedding',
    comment: 'Congratulations to your sister!',
    decidedBy: 'olivia',
    createdDaysAgo: 20,
  },
  { user: 'emma', from: 20, to: 24, status: PENDING, createdDaysAgo: 2 },
  { user: 'noah', from: -45, to: -41, status: APPROVED, decidedBy: 'olivia', createdDaysAgo: 70 },
  {
    user: 'noah',
    from: 5,
    to: 7,
    status: REJECTED,
    reason: 'Conference',
    comment: 'Two teammates are already off that week. Please pick other dates.',
    decidedBy: 'marcus',
    createdDaysAgo: 12,
  },
  {
    user: 'noah',
    from: 12,
    to: 19,
    status: APPROVED,
    reason: 'Hiking in the Alps',
    decidedBy: 'marcus',
    createdDaysAgo: 15,
  },
  {
    user: 'yuki',
    from: 1,
    to: 4,
    status: PENDING,
    reason: 'Medical appointments',
    createdDaysAgo: 4,
  },
  {
    user: 'yuki',
    from: 30,
    to: 44,
    status: APPROVED,
    reason: 'Visiting family in Osaka',
    decidedBy: 'olivia',
    createdDaysAgo: 25,
  },
  {
    user: 'sofia',
    from: -3,
    to: 2,
    status: APPROVED,
    reason: 'Recharge week',
    decidedBy: 'marcus',
    createdDaysAgo: 30,
  },
  {
    user: 'sofia',
    from: 25,
    to: 28,
    status: PENDING,
    reason: 'Friend’s birthday trip',
    createdDaysAgo: 2,
  },
  {
    user: 'daniel',
    from: -20,
    to: -18,
    status: REJECTED,
    comment: 'Coverage needed for the on-call rotation.',
    decidedBy: 'olivia',
    createdDaysAgo: 35,
  },
  {
    user: 'daniel',
    from: 8,
    to: 11,
    status: PENDING,
    reason: 'Paternity preparation',
    createdDaysAgo: 5,
  },
  {
    user: 'daniel',
    from: 50,
    to: 55,
    status: APPROVED,
    reason: 'Road trip',
    decidedBy: 'marcus',
    createdDaysAgo: 10,
  },
];

export interface SeedOptions {
  today: IsoDate;
  bcryptRounds: number;
  force?: boolean;
  log?: (message: string) => void;
}

/** Inserts demo users and vacation requests. Refuses to run on a non-empty database unless forced. */
export async function seedDatabase(dataSource: DataSource, options: SeedOptions): Promise<void> {
  const log = options.log ?? console.log;
  const existingUsers = await dataSource.getRepository(User).count();
  if (existingUsers > 0 && !options.force) {
    log(
      `Database already contains ${existingUsers} user(s) — skipping seed (use --force to reseed).`,
    );
    return;
  }

  await dataSource.transaction(async (manager) => {
    if (options.force) {
      await manager.query('TRUNCATE TABLE "audit_logs", "vacation_requests", "users" CASCADE');
    }

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, options.bcryptRounds);
    const userIds = new Map<string, string>();
    for (const seed of USERS) {
      const user = await manager.getRepository(User).save(
        manager.getRepository(User).create({
          name: seed.name,
          email: seed.email,
          password: passwordHash,
          role: seed.role,
        }),
      );
      userIds.set(seed.key, user.id);
    }

    const now = Date.now();
    const idOf = (key: string): string => {
      const id = userIds.get(key);
      if (!id) throw new Error(`Unknown seed user "${key}"`);
      return id;
    };

    await manager
      .createQueryBuilder()
      .insert()
      .into(VacationRequest)
      .values(
        REQUESTS.map((seed) => {
          const createdAt = new Date(now - seed.createdDaysAgo * 86_400_000);
          return {
            userId: idOf(seed.user),
            startDate: addDays(options.today, seed.from),
            endDate: addDays(options.today, seed.to),
            reason: seed.reason ?? null,
            status: seed.status,
            comments: seed.comment ?? null,
            decidedById: seed.decidedBy ? idOf(seed.decidedBy) : null,
            decidedAt: seed.decidedBy ? new Date(createdAt.getTime() + 86_400_000) : null,
            createdAt,
            updatedAt: createdAt,
          };
        }),
      )
      .execute();
  });

  log(`Seeded ${USERS.length} users and ${REQUESTS.length} vacation requests.`);
  log(`Demo accounts (password "${DEMO_PASSWORD}"):`);
  log('  requester → requester@example.com');
  log('  validator → validator@example.com');
}
