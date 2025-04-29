/**
 * Organization Excel download Test Suite
 */

describe('Organization Test Suite', () => {
  before(() => {
    cy.visit('/')
    // Login and visit the page
    cy.loginWith(
      'idir',
      Cypress.env('ADMIN_IDIR_USERNAME'),
      Cypress.env('ADMIN_IDIR_PASSWORD')
    )
    cy.get('.main-layout-navbar', { timeout: 30000 }).should('be.visible')
  })
  beforeEach(() => {
    cy.get('a.NavLink[href="/organizations"]').click()
    cy.get('.organizations-container', { timeout: 30000 }).should('be.visible')
  })
  after(() => {
    cy.logout()
  })

  describe('Organization Information Download', () => {
    it('downloads the organization information as an XLS file', () => {
      // Create a mock blob
      const mockBlob = new Blob(['mock data'], {
        type: 'application/vnd.ms-excel'
      })

      // Intercept the download request and respond with the mock blob
      cy.intercept('GET', '/api/organizations/export', mockBlob).as(
        'fileDownload'
      )

      cy.getByDataTest('download-org-button').click()

      // Wait for the file download request to complete
      cy.wait('@fileDownload').then((interception) => {
        expect(interception.response.statusCode).to.eq(200)
      })
    })

    it('shows an error message if the download fails', () => {
      // Intercept the download request and simulate a failure
      cy.intercept('GET', '/api/organizations/export', {
        statusCode: 500,
        body: 'Download failed'
      }).as('fileDownloadFail')

      cy.getByDataTest('download-org-button').click()

      // Wait for the failed file download request
      cy.wait('@fileDownloadFail', { timeout: 30000 }).then((interception) => {
        expect(interception.response.statusCode).to.eq(500)
      })

      // Check for the presence of the error message
      cy.getByDataTest('alert-box').should(
        'contain',
        'Failed to download organization information'
      )
    })
  })

  describe('User Information Download', () => {
    it('downloads the user information as an XLS file', () => {
      // Create a mock blob
      const mockBlob = new Blob(['mock data'], {
        type: 'application/vnd.ms-excel'
      })

      // Intercept the download request and respond with the mock blob
      cy.intercept('GET', '/api/users/export?format=xlsx', mockBlob).as(
        'fileDownload'
      )

      cy.getByDataTest('download-user-button', { timeout: 30000 })
        .should('be.visible')
        .click()

      // Wait for the file download request to complete
      cy.wait('@fileDownload', { timeout: 30000 }).then((interception) => {
        expect(interception.response.statusCode).to.eq(200)
      })
    })

    it('shows an error message if the download fails', () => {
      // Intercept the download request and simulate a failure
      cy.intercept('GET', '/api/users/export?format=xlsx', {
        statusCode: 500,
        body: 'Download failed'
      }).as('fileDownloadFail')

      cy.getByDataTest('download-user-button', { timeout: 30000 })
        .should('be.visible')
        .click()

      // Wait for the failed file download request
      cy.wait('@fileDownloadFail', { timeout: 30000 }).then((interception) => {
        expect(interception.response.statusCode).to.eq(500)
      })

      // Check for the presence of the error message
      cy.getByDataTest('alert-box').should(
        'contain',
        'Failed to download user information'
      )
    })
  })
})
