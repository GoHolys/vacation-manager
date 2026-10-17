import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Recreates the schema and demo data in the disposable test database before every run. */
export default function globalSetup(): void {
  const database = process.env.DB_TEST_NAME ?? 'vacation_manager_test';
  if (!database.endsWith('_test')) {
    throw new Error(`Refusing to reset "${database}": the e2e database name must end with _test`);
  }
  execSync('npm run db:reset -w backend', {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    stdio: 'inherit',
    env: { ...process.env, DB_NAME: database },
  });
}
