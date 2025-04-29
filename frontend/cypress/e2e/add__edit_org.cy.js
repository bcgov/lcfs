/**
 * Add Organization Test Suite.
 * This suite covers comprehensive testing of the Add Organization,
 * including validations, interactions, and submission.
 */

describe('Add Organization Test Suite', () => {
  beforeEach(() => {
    cy.loginWith(
      'idir',
      Cypress.env('ADMIN_IDIR_USERNAME'),
      Cypress.env('ADMIN_IDIR_PASSWORD')
    )
    cy.visit('/organizations/add-org')
  })

  afterEach(() => {
    cy.logout()
  })

  it('verifies that the add organization loads correctly', () => {
    cy.getByDataTest('addEditOrgContainer').should('be.visible')
  })

  context('Check if form validation works', () => {
    it('displays validation errors for empty required fields', () => {
      cy.getByDataTest('saveOrganization').click()
      cy.getByDataTest('orgLegalName').should(
        'contain',
        'Legal Name of Organization is required.'
      )
      cy.getByDataTest('orgEmailAddress').should(
        'contain',
        'Email Address is required.'
      )
      cy.getByDataTest('orgPhoneNumber').should(
        'contain',
        'Phone Number is required.'
      )
    })

    it('validates email and phone number formats', () => {
      cy.getByDataTest('orgEmailAddress').type('abc@')
      cy.getByDataTest('orgPhoneNumber').type('abc')
      cy.getByDataTest('saveOrganization').click()
      cy.getByDataTest('orgEmailAddress').should(
        'contain',
        'Please enter a valid Email Address.'
      )
      cy.getByDataTest('orgPhoneNumber').should('contain', 'Invalid format.')
    })
  })

  context('Field functionality and interaction', () => {
    it('autofills Operating Name when "Same as Legal Name" is checked', () => {
      const legalName = 'Test Legal Name'
      cy.getByDataTest('orgLegalName').type(legalName)
      cy.getByDataTest('sameAsLegalName').click()
      cy.getByDataTest('orgOperatingName')
        .find('input')
        .should('have.value', legalName)
    })
  })

  context('Form Submission', () => {
    it('submits the form successfully with valid data', () => {
      cy.get('#orgLegalName').type('Legal name')
      cy.get('#orgOperatingName').type('Operating name')
      cy.get('#orgEmailAddress').type('abc@domain.com')
      cy.get('#orgPhoneNumber').type('12345678')
      cy.getByDataTest('orgSupplierType1').click()
      cy.getByDataTest('orgRegForTransfers2').click()
      cy.getByDataTest('hasEarlyIssuanceNo').click()
      cy.get('#orgEDRMSRecord').type('12345')
      cy.get('.orgStreetAddress input').type('Street address')
      cy.get('#orgAddressOther').type('Address other')
      cy.get('#orgCity').type('City')
      cy.get('#orgPostalCodeZipCode').type('V3B 0G2')
      cy.get('.recordsAddress input').type('123 Street, BC')
      cy.get('#orgHeadOfficeStreetAddress').type('Street address')
      cy.get('#orgHeadOfficeAddressOther').type('Address other')
      cy.get('#orgHeadOfficeCity').type('City')
      cy.get('#orgHeadOfficeProvince').type('Province')
      cy.get('#orgHeadOfficeCountry').type('Country')
      cy.get('#orgHeadOfficePostalCodeZipCode').type('12345')

      cy.getByDataTest('saveOrganization').click()
      cy.getByDataTest('alert-box').should(
        'contain',
        'Organization has been successfully added.'
      )
    })
  })
})
