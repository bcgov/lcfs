/* eslint-disable cypress/unsafe-to-chain-command */
import { Given } from '@badeball/cypress-cucumber-preprocessor'

const currentComplianceYear = (new Date().getFullYear() - 1).toString()
const REPORT_VIEW_RE = /\/compliance-reporting\/\d+\/\d+$/

// Selects an enabled compliance year from an already-open year picker.
// Closes the picker with Esc when no year is selectable.
function selectComplianceYear() {
  cy.get('body').then(($modalBody) => {
    const enabledCurrentYear = `.compliance-period-${currentComplianceYear}:not(.Mui-disabled):not([aria-disabled="true"])`
    const enabledAnyYear =
      '[class*="compliance-period-"]:not(.Mui-disabled):not([aria-disabled="true"])'

    if ($modalBody.find(enabledCurrentYear).length > 0) {
      cy.get(enabledCurrentYear, { timeout: 10000 }).first().click({ force: true })
    } else if ($modalBody.find(enabledAnyYear).length > 0) {
      cy.get(enabledAnyYear, { timeout: 10000 }).first().click({ force: true })
    } else {
      // All years already have a report – dismiss and fall back to opening one.
      cy.get('body').type('{esc}')
    }
  })
}

Given(
  'the compliance schedule test user is logged in with a new draft report',
  () => {
    cy.loginWith(
      'bceid',
      Cypress.env('ORG1_BCEID_USERNAME') || Cypress.env('BCEID_TEST_USER'),
      Cypress.env('ORG1_BCEID_PASSWORD') || Cypress.env('BCEID_TEST_PASS')
    )
    cy.visit('/', { timeout: 60000 })
    cy.getByDataTest('dashboard-container', { timeout: 30000 }).should('exist')

    cy.get('a[href="/compliance-reporting"]').should('be.visible').click()

    // ── Step 1: try to create a fresh report via the year picker ──────────────
    cy.get('body', { timeout: 30000 }).then(($body) => {
      if ($body.find('.new-compliance-report-button').length > 0) {
        cy.get('.new-compliance-report-button').click()
        // Wait until year options are rendered in the DOM before selecting.
        cy.get('[class*="compliance-period-"]', { timeout: 10000 }).should(
          'have.length.greaterThan',
          0
        )
        selectComplianceYear()
      }
    })

    // Dismiss any lingering modal overlay (e.g. when all years are disabled).
    cy.get('body').then(($body) => {
      if ($body.find('.MuiModal-backdrop').length > 0) {
        cy.get('body').type('{esc}')
        cy.get('.MuiModal-backdrop', { timeout: 10000 }).should('not.exist')
      }
    })

    // ── Step 2: if still on the list page, open the first existing report ─────
    // NOTE: cy.location().then() queues a command; the URL here is evaluated
    // after all prior queued commands (including any navigation) have settled.
    cy.location('pathname', { timeout: 10000 }).then((pathname) => {
      if (REPORT_VIEW_RE.test(pathname.replace(/\/+$/, ''))) return

      cy.get('.ag-root-wrapper', { timeout: 30000 }).should('be.visible')
      cy.get('body').then(($pageBody) => {
        const reportLink = [
          ...$pageBody.find('a[href^="/compliance-reporting/"]')
        ].find((el) =>
          REPORT_VIEW_RE.test(el.getAttribute('href') || '')
        )

        if (reportLink) {
          cy.wrap(reportLink).click({ force: true })
        } else if ($pageBody.find('.new-compliance-report-button').length > 0) {
          cy.get('.new-compliance-report-button').click({ force: true })
          cy.get('[class*="compliance-period-"]', { timeout: 10000 }).should(
            'have.length.greaterThan',
            0
          )
          selectComplianceYear()
        } else {
          throw new Error(
            'Could not find an existing report link or open the year picker.'
          )
        }
      })
    })

    // ── Step 3: last-resort guard ─────────────────────────────────────────────
    // Only attempt further navigation when the URL still isn't a report view.
    // This avoids the race condition where the guard fires mid-navigation and
    // tries to find list-page elements that no longer exist.
    cy.location('pathname', { timeout: 30000 }).then((pathname) => {
      if (REPORT_VIEW_RE.test(pathname.replace(/\/+$/, ''))) return

      cy.get('body').then(($body) => {
        if ($body.find('.ag-column-first > a').length > 0) {
          cy.get('.ag-column-first > a').first().click({ force: true })
        } else if ($body.find('.new-compliance-report-button').length > 0) {
          cy.get('.new-compliance-report-button').click({ force: true })
          cy.get('[class*="compliance-period-"]', { timeout: 10000 }).should(
            'have.length.greaterThan',
            0
          )
          selectComplianceYear()
        }
      })
    })

    // ── Final assertion ───────────────────────────────────────────────────────
    // Wait for the URL to confirm we're on a report view before checking content.
    cy.location('pathname', { timeout: 30000 }).should('match', REPORT_VIEW_RE)
    cy.get('body', { timeout: 30000 }).should(($body) => {
      const hasIntro =
        $body.find('[data-test="compliance-report-intro"]').length > 0
      const hasHeader =
        $body.find('[data-test="compliance-report-header"]').length > 0
      expect(hasIntro || hasHeader).to.equal(true)
    })
  }
)
