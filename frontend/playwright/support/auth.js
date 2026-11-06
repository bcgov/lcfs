import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
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
    return {
      usernameKeys: [
        'PLAYWRIGHT_ADMIN_IDIR_USERNAME',
        'PLAYWRIGHT_IDIR_TEST_USER',
        'ADMIN_IDIR_USERNAME',
        'IDIR_TEST_USER'
      ],
      passwordKeys: [
        'PLAYWRIGHT_ADMIN_IDIR_PASSWORD',
        'PLAYWRIGHT_IDIR_TEST_PASS',
        'ADMIN_IDIR_PASSWORD',
        'IDIR_TEST_PASS'
      ]
    }
  }

  if (userType.toLowerCase() === 'bceid') {
    return {
      usernameKeys: [
        'PLAYWRIGHT_BCEID_TEST_USER',
        'BCEID_TEST_USER',
        'PLAYWRIGHT_ORG1_BCEID_USERNAME',
        'ORG1_BCEID_USERNAME',
        'PLAYWRIGHT_ORG2_BCEID_USERNAME',
        'ORG2_BCEID_USERNAME'
      ],
      passwordKeys: [
        'PLAYWRIGHT_BCEID_TEST_PASS',
        'BCEID_TEST_PASS',
        'PLAYWRIGHT_ORG1_BCEID_PASSWORD',
        'ORG1_BCEID_PASSWORD',
        'PLAYWRIGHT_ORG2_BCEID_PASSWORD',
        'ORG2_BCEID_PASSWORD'
      ]
    }
  }

  const prefix = userType.toUpperCase()
  return {
    usernameKeys: ['PLAYWRIGHT_' + prefix + '_USERNAME', prefix + '_USERNAME'],
    passwordKeys: ['PLAYWRIGHT_' + prefix + '_PASSWORD', prefix + '_PASSWORD']
  }
}

const readCredentials = (userType) => {
  const { usernameKeys, passwordKeys } = credentialsFor(userType)
  return {
    username: usernameKeys
      .map((key) => process.env[key] || cypressEnv[key])
      .find(Boolean),
    password: passwordKeys
      .map((key) => process.env[key] || cypressEnv[key])
      .find(Boolean)
  }
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

  await page.goto('/')
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
