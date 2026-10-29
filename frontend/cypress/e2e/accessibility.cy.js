// npm run cypress:run -- --spec cypress/e2e/accessibility.cy.js
/*
 * - Accessibility checks:
 *   - Login page
 *   - Navigation bar
 *   - TODO: Add more tests for other pages
 */

import { terminalLog } from '../support/e2e.js'

describe('Accessibility Tests for LCFS', () => {
  // Test for Login Page Accessibility
  describe('Login page accessibility', () => {
    beforeEach(() => {
      cy.visit('/login')
    })

    it('Should have no accessibility violations on load', () => {
      cy.loginWithEnv('idir')
      cy.get('.main-layout-navbar', { timeout: 30000 }).should('be.visible')
      cy.injectAxe() // Injects the axe-core library
      cy.checkA11y(null, null, terminalLog)
    })
  })

  // Test for Navigation Accessibility
  describe('Navigation Accessibility', () => {
    it('Should have no accessibility violations in the navigation bar', () => {
      cy.visit('/')
      cy.loginWithEnv('idir')
      cy.getByDataTest('bc-navbar', { timeout: 30000 }).should('be.visible')
      cy.injectAxe() // Injects the axe-core library
      cy.getByDataTest('bc-navbar').within(() => {
        cy.checkA11y(null, null, terminalLog)
      })
    })
  })
})
