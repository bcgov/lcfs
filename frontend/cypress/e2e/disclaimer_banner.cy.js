/**
 * Disclaimer Banner Visibility Test Suite.
 */

describe('Disclaimer Banner Visibility Test Suite', () => {
  context('BCeID User', () => {
    beforeEach(() => {
      cy.login(
        'bceid',
        Cypress.env('BCEID_TEST_USER'),
        Cypress.env('BCEID_TEST_PASS')
      )
      cy.visit('/')
    })

    afterEach(() => {
      cy.logout()
    })

    it('shows both the legal and privacy disclaimers for BCeID users', () => {
      cy.contains(
        'This information does not replace or constitute legal advice. Users are responsible for ensuring compliance with the Low Carbon Fuels Act and Regulations.'
      ).should('be.visible')
      cy.contains(
        "For security and privacy reasons, please don't share personal information on this website."
      ).should('be.visible')
    })
  })

  context('IDIR User', () => {
    beforeEach(() => {
      cy.login(
        'idir',
        Cypress.env('IDIR_TEST_USER'),
        Cypress.env('IDIR_TEST_PASS')
      )
      cy.visit('/')
    })

    afterEach(() => {
      cy.logout()
    })

    it('shows only the privacy disclaimer for IDIR users', () => {
      cy.contains(
        'This information does not replace or constitute legal advice. Users are responsible for ensuring compliance with the Low Carbon Fuels Act and Regulations.'
      ).should('not.exist')
      cy.contains(
        "For security and privacy reasons, please don't share personal information on this website."
      ).should('be.visible')
    })
  })
})
