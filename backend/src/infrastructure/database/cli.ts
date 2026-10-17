/**
 * Database management CLI.
 *
 *   npm run db:migrate          apply pending migrations
 *   npm run db:revert           revert the last migration
 *   npm run db:seed [-- --force] insert demo data (force = wipe data first)
 *   npm run db:reset            drop everything, migrate, seed
 */
import 'reflect-metadata';
import { loadEnv } from 'commoneventframework';
import { loadConfig } from '../../config/env';
import { SystemClock } from '../../core/clock';
import { createDataSource } from './data-source';
import { seedDatabase } from './seed';

const COMMANDS = ['migrate', 'revert', 'seed', 'reset'] as const;
type CliCommand = (typeof COMMANDS)[number];

async function main(): Promise<void> {
  const command = process.argv[2] as CliCommand | undefined;
  if (!command || !COMMANDS.includes(command)) {
    console.error(`Usage: cli <${COMMANDS.join('|')}> [--force]`);
    process.exitCode = 1;
    return;
  }

  await loadEnv(); // Common Event Framework: loads .env / .env.local
  const config = loadConfig();
  const dataSource = createDataSource({ ...config.database, logging: false });
  await dataSource.initialize();
  console.log(
    `→ ${command} on ${config.database.database}@${config.database.host}:${config.database.port}`,
  );

  const runMigrations = async () => {
    const applied = await dataSource.runMigrations({ transaction: 'each' });
    console.log(
      applied.length
        ? `Applied: ${applied.map((m) => m.name).join(', ')}`
        : 'No pending migrations.',
    );
  };
  const seed = (force: boolean) =>
    seedDatabase(dataSource, {
      today: new SystemClock(config.timeZone).today(),
      bcryptRounds: config.auth.bcryptRounds,
      force,
    });

  try {
    switch (command) {
      case 'migrate':
        await runMigrations();
        break;
      case 'revert':
        await dataSource.undoLastMigration({ transaction: 'each' });
        console.log('Reverted the last migration.');
        break;
      case 'seed':
        await seed(process.argv.includes('--force'));
        break;
      case 'reset':
        await dataSource.dropDatabase();
        console.log('Dropped all tables.');
        await runMigrations();
        await seed(true);
        break;
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
