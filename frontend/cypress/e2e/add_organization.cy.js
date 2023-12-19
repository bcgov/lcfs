/**
 * Add Organization Test Suite.
 * This suite covers comprehensive testing of the Add Organization,
 * including validations, interactions, and submission.
 */

describe('Add Organization Test Suite', () => {
  beforeEach(() => {
    cy.login(
      'idir',
      Cypress.env('IDIR_TEST_USER'),
      Cypress.env('IDIR_TEST_PASS')
    )
    cy.visit('/organization/add')
  })

  afterEach(() => {
    cy.logout()
  })

  it('verifies that the add organization loads correctly', () => {
    cy.getByDataTest('addOrganizationContainer').should('be.visible')
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
      cy.getByDataTest('orgLegalName').type('Legal name')
      cy.getByDataTest('orgOperatingName').type('Operating name')
      cy.getByDataTest('orgEmailAddress').type('abc@domain.com')
      cy.getByDataTest('orgPhoneNumber').type('12345678')
      cy.getByDataTest('orgSupplierType1').click()
      cy.getByDataTest('orgRegForTransfers2').click()
      cy.getByDataTest('orgEDRMSRecord').type('12345')
      cy.getByDataTest('orgStreetAddress').type('Street address')
      cy.getByDataTest('orgAddressOther').type('Address other')
      cy.getByDataTest('orgCity').type('City')
      cy.getByDataTest('orgPostalCodeZipCode').type('V3B 0G2')
      cy.getByDataTest('orgAttroneyStreetAddress').type('Street address')
      cy.getByDataTest('orgAttroneyAddressOther').type('Address other')
      cy.getByDataTest('orgAttroneyCity').type('City')
      cy.getByDataTest('orgAttroneyPostalCodeZipCode').type('12345')

      cy.getByDataTest('saveOrganization').click()
      cy.getByDataTest('alert-box').should(
        'contain',
        'Organization has been successfully added.'
      )
    })
  })
})
