import 'cypress-axe'

describe('Accessibility Tests for LCFS', () => {
  // Test for Home Page Accessibility
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
    beforeEach(() => {
      cy.visit('/')
      cy.injectAxe()
      cy.login(
        'idir',
        Cypress.env('IDIR_TEST_USER'),
        Cypress.env('IDIR_TEST_PASS')
      )
    })

    it('Should have no accessibility violations in the navigation bar', () => {
      cy.get('nav').within(() => {
        cy.checkA11y()
      })
    })
  })
})
