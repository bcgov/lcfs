// npm run cypress:run -- --spec cypress/e2e/accessibility.cy.js

import { terminalLog } from '../support/e2e.js'

describe('Accessibility Tests for LCFS', () => {
  // Test for Login Page Accessibility
  describe('Login page accessibility', () => {
    beforeEach(() => {
      cy.visit('/login')
    })

    it('Should have no accessibility violations on load', () => {
      cy.loginWith(
        'idir',
        Cypress.env('IDIR_TEST_USER'),
        Cypress.env('IDIR_TEST_PASS')
      )
      cy.wait(5000)
      cy.injectAxe() // Injects the axe-core library
      cy.checkA11y(null, null, terminalLog)
    })
  })

  // Test for Navigation Accessibility
  describe('Navigation Accessibility', () => {
    it('Should have no accessibility violations in the navigation bar', () => {
      cy.visit('/')
      cy.loginWith(
        'idir',
        Cypress.env('IDIR_TEST_USER'),
        Cypress.env('IDIR_TEST_PASS')
      )
      cy.wait(5000)
      cy.injectAxe() // Injects the axe-core library
      cy.getByDataTest('bc-navbar').should('exist')
      cy.getByDataTest('bc-navbar').within(() => {
        cy.checkA11y(null, null, terminalLog)
      })
    })
  })
})
