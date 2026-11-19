import { expect } from '@playwright/test'
import { Given, Then, When, getByDataTest } from '../support/fixtures.js'

Given('I open the LCFS login page', async ({ page }) => {
  await page.goto('/login')
})

Then('I see the BCeID and IDIR sign-in options', async ({ page }) => {
  await expect(getByDataTest(page, 'login-container')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Login with BCeID' })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Login with IDIR' })
  ).toBeVisible()
})

When('I open a protected organization route', async ({ page }) => {
  await page.goto('/organizations')
})

Then('I am redirected to the login page', async ({ page }) => {
  await expect(page).toHaveURL(/\/login$/)
  await expect(getByDataTest(page, 'login-container')).toBeVisible()
})
