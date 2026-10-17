import { expect, test, REQUESTER, signIn, signOut, VALIDATOR } from './support';

test.describe('authentication & role guards', () => {
  test('sends anonymous visitors to sign-in and back to the page they wanted', async ({ page }) => {
    await page.goto('/review?status=pending');
    await expect(page).toHaveURL(/\/login\?redirect=/);

    await page.getByLabel('Email').fill(VALIDATOR);
    await page.getByLabel('Password', { exact: true }).fill('Password123!');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/review\?status=pending/);
  });

  test('shows a clear error for wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(REQUESTER);
    await page.getByLabel('Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Invalid email or password');
  });

  test('each role lands on its own home and cannot open the other role’s pages', async ({
    page,
  }) => {
    await signIn(page, REQUESTER);
    await expect(page).toHaveURL(/\/my-requests/);
    await page.goto('/review');
    await expect(page).toHaveURL(/\/my-requests/);
    await signOut(page);

    await signIn(page, VALIDATOR);
    await expect(page).toHaveURL(/\/review/);
    await page.goto('/my-requests');
    await expect(page).toHaveURL(/\/review/);
  });

  test('one-click demo accounts sign in', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Olivia Bennett/ }).click();
    await expect(page.getByRole('heading', { name: 'Review requests' })).toBeVisible();
  });
});
