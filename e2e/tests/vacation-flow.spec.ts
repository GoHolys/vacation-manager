import { expect, test, isoInDays, REQUESTER, signIn, signOut, VALIDATOR } from './support';

/**
 * The full life-cycle of requests across both roles. Steps share state (one fresh database per
 * run), so they run in order.
 */
test.describe.configure({ mode: 'serial' });

test.describe('vacation request life-cycle', () => {
  test('requester gets instant feedback on invalid dates', async ({ page }) => {
    await signIn(page, REQUESTER);
    await page.getByRole('button', { name: 'Submit request' }).click();
    await expect(page.getByText('Choose the first day of your vacation.')).toBeVisible();

    await page.getByLabel('First day').fill(isoInDays(130));
    await page.getByLabel('Last day').fill(isoInDays(130));
    await page.getByRole('button', { name: 'Submit request' }).click();
    await expect(page.getByText('The end date must be after the start date.')).toBeVisible();
  });

  test('requester submits a request and sees it pending', async ({ page }) => {
    await signIn(page, REQUESTER);
    await page.getByLabel('First day').fill(isoInDays(120));
    await page.getByLabel('Last day').fill(isoInDays(124));
    await page.getByLabel('Reason').fill('E2E holiday');
    await expect(page.getByText(/5 days away/)).toBeVisible();
    await page.getByRole('button', { name: 'Submit request' }).click();

    await expect(page.getByText('Request submitted')).toBeVisible();
    const row = page.getByRole('listitem').filter({ hasText: 'E2E holiday' });
    await expect(row.getByText('Pending')).toBeVisible();
  });

  test('overlapping dates are refused with the conflicting request listed', async ({ page }) => {
    await signIn(page, REQUESTER);
    await page.getByLabel('First day').fill(isoInDays(122));
    await page.getByLabel('Last day').fill(isoInDays(126));
    await page.getByRole('button', { name: 'Submit request' }).click();
    await expect(page.getByText('These dates clash with another request')).toBeVisible();
  });

  test('validator approves with a note; rejecting requires a comment', async ({ page }) => {
    await signIn(page, VALIDATOR);
    await page.getByRole('radio', { name: /Pending/ }).click();
    await expect(page).toHaveURL(/status=pending/);

    const approveRow = page.locator('tr', { hasText: 'E2E holiday' });
    await approveRow.getByRole('button', { name: 'Approve' }).click();
    await page.getByLabel('Note to the requester').fill('Have a great break!');
    await page.getByRole('button', { name: 'Approve request' }).click();
    await expect(page.getByText('Request approved')).toBeVisible();
    await expect(approveRow).toHaveCount(0);

    const rejectRow = page.locator('tr', { hasText: 'Moving apartments' });
    await rejectRow.getByRole('button', { name: 'Reject' }).click();
    await page.getByRole('button', { name: 'Reject request' }).click();
    await expect(page.getByText('Tell the requester why')).toBeVisible();
    await page.getByRole('button', { name: /Too many teammates/ }).click();
    await page.getByRole('button', { name: 'Reject request' }).click();
    await expect(page.getByText('Request rejected')).toBeVisible();
  });

  test('validator filters live in the URL and survive a reload', async ({ page }) => {
    await signIn(page, VALIDATOR);
    await page.locator('#user-filter').selectOption({ label: 'Liam Carter' });
    await expect(page).toHaveURL(/user=/);
    await page.reload();
    await expect(page.locator('#user-filter')).not.toHaveValue('');
    await expect(page.locator('tbody tr')).not.toHaveCount(0);
    for (const name of await page
      .locator('tbody tr td:first-child p.font-semibold')
      .allTextContents()) {
      expect(name).toBe('Liam Carter');
    }
  });

  test('requester sees the decisions, resubmits the rejected request and cancels it', async ({
    page,
  }) => {
    await signIn(page, REQUESTER);
    const approved = page.getByRole('listitem').filter({ hasText: 'E2E holiday' });
    await expect(approved.getByText('Locked once approved')).toBeVisible();
    await expect(approved.getByText('Have a great break!')).toBeVisible();

    const rejected = page.getByRole('listitem').filter({ hasText: 'Moving apartments' });
    await expect(rejected.getByText(/Too many teammates/)).toBeVisible();
    await rejected.getByRole('button', { name: 'Edit & resubmit' }).click();
    await page.getByLabel('First day').fill(isoInDays(140));
    await page.getByLabel('Last day').fill(isoInDays(142));
    await page.getByRole('button', { name: 'Resubmit request' }).click();
    await expect(page.getByText('Request resubmitted')).toBeVisible();

    await page
      .getByRole('listitem')
      .filter({ hasText: 'Moving apartments' })
      .getByRole('button', { name: 'Cancel' })
      .click();
    await page.getByRole('button', { name: 'Cancel request' }).click();
    await expect(page.getByText('Request cancelled')).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Moving apartments' })).toHaveCount(
      0,
    );
    await signOut(page);
  });
});
