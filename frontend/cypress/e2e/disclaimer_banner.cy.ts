/**
 * Disclaimer Banner Visibility Test Suite.
 */

describe('Disclaimer Banner Visibility Test Suite', () => {
  context('BCeID User', () => {
    it('shows both the legal and privacy disclaimers for BCeID users', () => {
      cy.visit('/')
      cy.loginWith(
        'bceid',
        Cypress.env('BCEID_TEST_USER'),
        Cypress.env('BCEID_TEST_PASS')
      )
      cy.contains(
        'This information does not replace or constitute legal advice. Users are responsible for ensuring compliance with the Low Carbon Fuels Act and Regulations.',
        { timeout: 30000 }
      ).should('be.visible')
      cy.contains(
        "For security and privacy, please don't share personal information on this website."
      ).should('be.visible')
      cy.logout()
    })
  })

  context('IDIR User', () => {
    it('shows only the privacy disclaimer for IDIR users', () => {
      cy.loginWith(
        'idir',
        Cypress.env('ADMIN_IDIR_USERNAME'),
        Cypress.env('ADMIN_IDIR_PASSWORD')
      )
      cy.contains(
        'This information does not replace or constitute legal advice. Users are responsible for ensuring compliance with the Low Carbon Fuels Act and Regulations.'
      ).should('not.exist')
      cy.contains(
        "For security and privacy, please don't share personal information on this website."
      ).should('be.visible')
      cy.logout()
    })
  })
})
