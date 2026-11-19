import { expect } from '@playwright/test'
import { getByDataTest, test } from '../support/fixtures.js'
import {
  authCredentialHint,
  hasAuthCredentials,
  loginWithEnv
} from '../support/auth.js'

test.describe('Admin view happy paths', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasAuthCredentials('idir'), authCredentialHint('idir'))
    await loginWithEnv(page, 'idir')
  })

  test('allows administrators to open the add user form from the user list', async ({
    page
  }) => {
    await page.goto('/admin/users')
    await expect(getByDataTest(page, 'add-user-btn')).toBeVisible()
    await expect(getByDataTest(page, 'bc-grid-container')).toBeVisible()
    await getByDataTest(page, 'add-user-btn').click()
    await expect(page).toHaveURL(/\/admin\/users\/add-user$/)
    await expect(getByDataTest(page, 'saveUser')).toBeVisible()
  })

  test('switches between admin tabs and loads the related grids', async ({
    page
  }) => {
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
  })
})
