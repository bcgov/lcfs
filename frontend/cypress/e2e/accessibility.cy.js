// npm run cypress:run -- --spec cypress/e2e/accessibility.cy.js

describe('Accessibility Tests for LCFS', () => {
  // Test for Login Page Accessibility
  describe('Login page accessibility', () => {
    beforeEach(() => {
      cy.visit('/')
      cy.injectAxe() // Injects the axe-core library
    })

    it('Should have no accessibility violations on load', () => {
      cy.checkA11y()
    })
  })

  // Test for Navigation Accessibility
  describe('Navigation Accessibility', () => {
    it('Should have no accessibility violations in the navigation bar', () => {
      cy.visit('/')
      cy.injectAxe()
      cy.login(
        'idir',
        Cypress.env('IDIR_TEST_USER'),
        Cypress.env('IDIR_TEST_PASS')
      )
      cy.getByDataTest('bc-navbar').should('exist')
      cy.getByDataTest('bc-navbar').within(() => {
        cy.checkA11y()
      })
    })
  })
})
