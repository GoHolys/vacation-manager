import { expect, test, expectAccessible, REQUESTER, signIn, VALIDATOR } from './support';

/** Automated WCAG 2.1 AA audit (axe-core) of every screen and dialog, on desktop and mobile. */
test.describe('accessibility', () => {
  test('sign-in page, including its error state', async ({ page }) => {
    await page.goto('/login');
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expectAccessible(page);
  });

  test('requester screens and dialogs', async ({ page }) => {
    await signIn(page, REQUESTER);
    await expectAccessible(page);

    await page.getByRole('button', { name: 'Submit request' }).click();
    await expectAccessible(page);

    await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectAccessible(page);
    await page.keyboard.press('Escape');

    await page.goto('/team');
    await expectAccessible(page);
  });

  test('validator dashboard and decision dialog', async ({ page }) => {
    await signIn(page, VALIDATOR);
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Reject' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectAccessible(page);
  });

  test('not-found page', async ({ page }) => {
    await page.goto('/does-not-exist');
    await expectAccessible(page);
  });

  test('filter tabs are operable with the keyboard', async ({ page }) => {
    await signIn(page, VALIDATOR);
    const all = page.getByRole('radio', { name: /All/ });
    await all.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: /Pending/ })).toBeFocused();
    await expect(page).toHaveURL(/status=pending/);
  });
});
