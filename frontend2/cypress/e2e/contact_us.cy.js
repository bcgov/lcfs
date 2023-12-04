/**
 * Contact Us Page Test Suite.
 * This suite verifies the rendering and visibility of various sections on the Contact Us page.
 */

describe('Contact Us Page Test Suite', () => {
  beforeEach(() => {
    cy.visit('/contact-us')
  })

  it('ensures the page loads correctly', () => {
    cy.getByDataTest('contact-us-container').should('exist')
  })

  describe('Low Carbon Fuel Standard Section', () => {
    it('confirms the section is rendered and visible', () => {
      cy.getByDataTest('contact-lcfs-section').should('be.visible')
    })
  })

  describe('BCeID Section', () => {
    it('confirms the section is rendered and visible', () => {
      cy.getByDataTest('contact-bceid-section').should('be.visible')
    })
  })

  describe('IDIR Section', () => {
    it('confirms the section is rendered and visible', () => {
      cy.getByDataTest('contact-idir-section').should('be.visible')
    })
  })
})
