import { expect } from '@playwright/test'
import { Given, Then, When, getByDataTest, test } from '../support/fixtures.js'
import {
  authCredentialHint,
  hasAuthCredentials,
  loginWithEnv
} from '../support/auth.js'

Given('I am signed in as an administrator', async ({ page }) => {
  test.skip(!hasAuthCredentials('idir'), authCredentialHint('idir'))
  await loginWithEnv(page, 'idir')
})

When(
  'I open the admin user list and choose to add a user',
  async ({ page }) => {
    await page.goto('/admin/users')
    await expect(getByDataTest(page, 'add-user-btn')).toBeVisible()
    await expect(getByDataTest(page, 'bc-grid-container')).toBeVisible()
    await getByDataTest(page, 'add-user-btn').click()
  }
)

Then('the add user form is shown', async ({ page }) => {
  await expect(page).toHaveURL(/\/admin\/users\/add-user$/)
  await expect(getByDataTest(page, 'saveUser')).toBeVisible()
})

When(
  'I visit the user activity, login history, and audit log tabs',
  async ({ page }) => {
    await page.goto('/admin/users')
    await expect(getByDataTest(page, 'bc-grid-container')).toBeVisible()

    const tabs = [
      { label: 'User activity', path: '/admin/user-activity', panelIndex: 1 },
      {
        label: 'User login history',
        path: '/admin/user-login-history',
        panelIndex: 2
      },
      { label: 'Audit log', path: '/admin/audit-log', panelIndex: 3 }
    ]

    for (const { label, path, panelIndex } of tabs) {
      await page.getByRole('tab', { name: label }).click()
      await expect(page).toHaveURL(new RegExp(path + '$'))
      await expect(
        page.locator(
          `#full-width-AdminTabPanel-${panelIndex} [data-test="bc-grid-container"]`
        )
      ).toBeVisible()
    }
  }
)

Then('each selected admin tab shows its grid', async ({ page }) => {
  await expect(page).toHaveURL(/\/admin\/audit-log$/)
  await expect(
    page.locator('#full-width-AdminTabPanel-3 [data-test="bc-grid-container"]')
  ).toBeVisible()
})
