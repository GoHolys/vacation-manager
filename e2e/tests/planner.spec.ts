import { expect, test, REQUESTER, signIn } from './support';

test.describe('team planner', () => {
  test('shows the month, the team and who is away today', async ({ page }) => {
    await signIn(page, REQUESTER);
    await page.getByRole('link', { name: 'Team planner' }).click();

    const month = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(
      new Date(),
    );
    await expect(page.getByRole('heading', { name: month })).toBeVisible();
    await expect(page.getByText('Away today:')).toBeVisible();
    // Accessible summary of the wall chart.
    await expect(page.getByRole('region', { name: /Team planner grid/ })).toContainText(
      'Liam Carter (you)',
    );
  });

  test('navigates between months and keeps the month in the URL', async ({ page }) => {
    await signIn(page, REQUESTER);
    await page.goto('/team');
    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(page).toHaveURL(/month=\d{4}-\d{2}/);
    await page.getByRole('button', { name: 'This month' }).click();
    await expect(page).not.toHaveURL(/month=/);
  });
});
