/**
 * Organization Test Suite
 */

describe('Organization Information Download', () => {
  beforeEach(() => {
    // Login and visit the page
    cy.login(
      'idir',
      Cypress.env('IDIR_TEST_USER'),
      Cypress.env('IDIR_TEST_PASS')
    )
    cy.visit('/organizations')
  })

  afterEach(() => {
    cy.logout()
  })

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
    cy.wait('@fileDownloadFail').then((interception) => {
      expect(interception.response.statusCode).to.eq(500)
    })

    // Check for the presence of the error message
    cy.getByDataTest('alert-box').should(
      'contain',
      'Failed to download organization information'
    )
  })
})
