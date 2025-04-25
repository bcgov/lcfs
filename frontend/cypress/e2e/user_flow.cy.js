/**
 * User Login Test Suite.
 * This suite includes tests for both IDIR and BCeID login flows,
 * verifying login page load, successful login, and logout functionality.
 */

describe('User Login Test Suite', () => {
  beforeEach(() => {
    cy.visit('/')
  })
  it('verifies that the login page loads correctly', () => {
    cy.getByDataTest('login-container').should('exist')
  })

  it('redirects unauthenticated users to the login page', () => {
    // Visit a protected route
    cy.visit('/organizations')
    // Check if the user is redirected to the login page
    cy.url().should('include', '/login')
  })

  describe('IDIR Login Flow', () => {
    it('completes login with IDIR user credentials', () => {
      cy.loginWith(
        'idir',
        Cypress.env('IDIR_TEST_USER'),
        Cypress.env('IDIR_TEST_PASS')
      )
      cy.get('.main-layout-navbar', { timeout: 30000 }).should('be.visible')
    })

    it('executes logout functionality for IDIR user', () => {
      cy.loginWith(
        'idir',
        Cypress.env('IDIR_TEST_USER'),
        Cypress.env('IDIR_TEST_PASS')
      )
      cy.logout()
    })
  })

  describe('BCeID Login Flow', () => {
    it('completes login with BCeID user credentials', () => {
      cy.loginWith(
        'bceid',
        Cypress.env('BCEID_TEST_USER'),
        Cypress.env('BCEID_TEST_PASS')
      )
    })
  })
})
