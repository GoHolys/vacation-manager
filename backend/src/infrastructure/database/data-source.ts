import 'reflect-metadata';
import { DataSource } from 'typeorm';
import type { AppConfig } from '../../config/env';
import { AuditLog } from '../../modules/audit/audit-log.entity';
import { UserRecord } from '../../modules/users/infrastructure/user.record';
import { VacationRequestRecord } from '../../modules/vacation-requests/infrastructure/vacation-request.record';
import { InitialSchema1760659200000 } from './migrations/1760659200000-InitialSchema';

export const ENTITIES = [UserRecord, VacationRequestRecord, AuditLog];
export const MIGRATIONS = [InitialSchema1760659200000];

/**
 * Entities and migrations are registered explicitly (no glob patterns) so the very same
 * configuration works with `tsx` in development, compiled JS in production and bundlers.
 * The schema is *only* changed through migrations — `synchronize` is always off.
 */
export function createDataSource(database: AppConfig['database']): DataSource {
  return new DataSource({
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database,
    ssl: database.ssl ? { rejectUnauthorized: true } : false,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    migrationsTableName: 'typeorm_migrations',
    synchronize: false,
    uuidExtension: 'pgcrypto',
    logging: database.logging ? ['query', 'error'] : ['error'],
    extra: { max: 10, idleTimeoutMillis: 30_000 },
  });
}
