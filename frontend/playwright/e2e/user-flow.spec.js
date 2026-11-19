import { expect } from '@playwright/test'
import { getByDataTest, test } from '../support/fixtures.js'

test('login page shows the available sign-in options', async ({ page }) => {
  await page.goto('/login')

  await expect(getByDataTest(page, 'login-container')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Login with BCeID' })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Login with IDIR' })
  ).toBeVisible()
})

test('unauthenticated users are redirected from protected routes', async ({
  page
}) => {
  await page.goto('/organizations')

  await expect(page).toHaveURL(/\/login$/)
  await expect(getByDataTest(page, 'login-container')).toBeVisible()
})
