import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { findCompleteCredentialPair } from '../../e2e/credential-pairs.js'
import { getByDataTest } from './fixtures.js'

const cypressEnvPath = fileURLToPath(
  new URL('../../cypress.env.json', import.meta.url)
)
let cypressEnv = {}
try {
  cypressEnv = JSON.parse(readFileSync(cypressEnvPath, 'utf8'))
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw new Error(
      'Could not read local Cypress credentials: ' + error.message
    )
  }
}

const credentialsFor = (userType) => {
  if (userType.toLowerCase() === 'idir') {
    return [
      {
        usernameKey: 'PLAYWRIGHT_ADMIN_IDIR_USERNAME',
        passwordKey: 'PLAYWRIGHT_ADMIN_IDIR_PASSWORD'
      },
      {
        usernameKey: 'PLAYWRIGHT_IDIR_TEST_USER',
        passwordKey: 'PLAYWRIGHT_IDIR_TEST_PASS'
      },
      {
        usernameKey: 'ADMIN_IDIR_USERNAME',
        passwordKey: 'ADMIN_IDIR_PASSWORD'
      },
      { usernameKey: 'IDIR_TEST_USER', passwordKey: 'IDIR_TEST_PASS' }
    ]
  }

  if (userType.toLowerCase() === 'bceid') {
    return [
      {
        usernameKey: 'PLAYWRIGHT_BCEID_TEST_USER',
        passwordKey: 'PLAYWRIGHT_BCEID_TEST_PASS'
      },
      { usernameKey: 'BCEID_TEST_USER', passwordKey: 'BCEID_TEST_PASS' },
      {
        usernameKey: 'PLAYWRIGHT_ORG1_BCEID_USERNAME',
        passwordKey: 'PLAYWRIGHT_ORG1_BCEID_PASSWORD'
      },
      {
        usernameKey: 'ORG1_BCEID_USERNAME',
        passwordKey: 'ORG1_BCEID_PASSWORD'
      },
      {
        usernameKey: 'PLAYWRIGHT_ORG2_BCEID_USERNAME',
        passwordKey: 'PLAYWRIGHT_ORG2_BCEID_PASSWORD'
      },
      { usernameKey: 'ORG2_BCEID_USERNAME', passwordKey: 'ORG2_BCEID_PASSWORD' }
    ]
  }

  const prefix = userType.toUpperCase()
  return [
    {
      usernameKey: 'PLAYWRIGHT_' + prefix + '_USERNAME',
      passwordKey: 'PLAYWRIGHT_' + prefix + '_PASSWORD'
    },
    { usernameKey: prefix + '_USERNAME', passwordKey: prefix + '_PASSWORD' }
  ]
}

const readCredentials = (userType) => {
  return findCompleteCredentialPair(credentialsFor(userType), (key) => {
    const value = process.env[key] || cypressEnv[key]
    return typeof value === 'string' ? value : undefined
  })
}

export const hasAuthCredentials = (userType) => {
  const { username, password } = readCredentials(userType)
  return Boolean(username && password)
}

export const authCredentialHint = (userType) => {
  if (userType.toLowerCase() === 'idir') {
    return 'Set PLAYWRIGHT_IDIR_TEST_USER and PLAYWRIGHT_IDIR_TEST_PASS in frontend/.env.'
  }
  return 'Set the matching PLAYWRIGHT_* credentials in frontend/.env.'
}

export const loginWithEnv = async (page, userType) => {
  const { username, password } = readCredentials(userType)
  if (!username || !password) {
    throw new Error(authCredentialHint(userType))
  }

  await page.goto('/login')
  await getByDataTest(page, 'link-' + userType.toLowerCase()).click()

  const usernameInput = page.locator('input[name="user"]')
  const passwordInput = page.locator('input[name="password"]')
  await expect(usernameInput).toBeVisible({ timeout: 60_000 })
  await usernameInput.fill(username)
  await passwordInput.fill(password)

  const loginRequest = page.waitForResponse((response) => {
    const request = response.request()
    const url = new URL(response.url())
    return (
      request.method() === 'POST' &&
      url.pathname.endsWith('/protocol/openid-connect/token')
    )
  })
  await page.locator('form').evaluate((form) => form.requestSubmit())
  const loginResponse = await loginRequest
  expect(loginResponse.status()).toBe(200)
  const { access_token: accessToken } = await loginResponse.json()
  expect(typeof accessToken).toBe('string')
  expect(accessToken.length).toBeGreaterThan(0)
  await expect(page.locator('.main-layout-navbar')).toBeVisible({
    timeout: 60_000
  })
}
