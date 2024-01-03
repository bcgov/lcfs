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

  it('should display the help link', () => {
    cy.getByDataTest('login-help-link')
      .should('be.visible')
      .and('have.attr', 'href', '/contact-us')
  })

  it('redirects unauthenticated users to the login page', () => {
    // Visit a protected route
    cy.visit('/organizations')
    // Check if the user is redirected to the login page
    cy.url().should('include', '/login')
  })

  describe('IDIR Login Flow', () => {
    it('fails login with wrong IDIR user credentials', () => {
      cy.login('idir', 'wrong_username', 'wrong_password')
      cy.getByDataTest('main-layout-navbar').should('not.exist')
    })

    it('completes login with IDIR user credentials', () => {
      cy.login(
        'idir',
        Cypress.env('IDIR_TEST_USER'),
        Cypress.env('IDIR_TEST_PASS')
      )
      cy.getByDataTest('main-layout-navbar').should('be.visible')
    })

    it('executes logout functionality for IDIR user', () => {
      cy.login(
        'idir',
        Cypress.env('IDIR_TEST_USER'),
        Cypress.env('IDIR_TEST_PASS')
      )
      cy.logout()
    })
  })

  describe('BCeID Login Flow', () => {
    it('fails login with wrong BCeID user credentials', () => {
      cy.login('bceid', 'wrong_username', 'wrong_password')
      cy.getByDataTest('main-layout-navbar').should('not.exist')
    })

    it('completes login with BCeID user credentials', () => {
      cy.login(
        'bceid',
        Cypress.env('BCEID_TEST_USER'),
        Cypress.env('BCEID_TEST_PASS')
      )
      // we are testing successful keycloak login but the user
      // does not exist in the LCFS db so it shows the error
      cy.contains('No User with that configuration exists.').should(
        'be.visible'
      )
    })
  })
})
