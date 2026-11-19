import { expect } from '@playwright/test'
import { createBdd, test as bddTest } from 'playwright-bdd'
import { playwrightTasks } from './node-tasks.js'
import { isKnownTransientException } from '../../e2e/known-page-errors.js'

export const test = bddTest.extend({
  page: async ({ page }, use) => {
    const unexpectedPageErrors = []
    const onPageError = (error) => {
      if (isKnownTransientException(error)) {
        console.warn(
          'Ignoring known transient application error:',
          error.message
        )
        return
      }
      unexpectedPageErrors.push(error)
    }

    page.on('pageerror', onPageError)
    // Playwright fixture lifecycle callback, not a React Hook.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page)
    page.off('pageerror', onPageError)

    expect(
      unexpectedPageErrors.map((error) => error.message),
      'Unexpected uncaught page errors'
    ).toEqual([])
  },
  // Playwright's fixture callback intentionally does not consume other fixtures.
  // eslint-disable-next-line no-empty-pattern
  tasks: async ({}, use) => {
    // Playwright fixture lifecycle callback, not a React Hook.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(playwrightTasks)
  }
})

export const { Given, When, Then, Step, Before, After } = createBdd(test)

export const getByDataTest = (page, selector) =>
  page.locator('[data-test="' + selector + '"]')
