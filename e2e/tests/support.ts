import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page } from '@playwright/test';

/**
 * `test` with a guard: any Vue runtime warning or uncaught page error fails the test, so
 * problems that don't break an assertion (lost attributes, bad props…) are still caught.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.text().includes('[Vue warn]')) problems.push(message.text().split('\n')[0] ?? '');
    });
    page.on('pageerror', (error) => problems.push(`Uncaught: ${error.message}`));
    await use(page);
    expect(problems, 'Vue warnings / page errors').toEqual([]);
  },
});

export { expect };

export const PASSWORD = 'Password123!';
export const REQUESTER = 'requester@example.com';
export const VALIDATOR = 'validator@example.com';

/** Calendar date `days` from today in the browser's time zone, as YYYY-MM-DD. */
export function isoInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(/\/login/);
}

/** Fails the test on any WCAG 2.1 A/AA (or axe best-practice) violation. */
export async function expectAccessible(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  );
  expect(summary).toEqual([]);
}
