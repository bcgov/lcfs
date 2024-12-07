import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'

const currentYear = new Date().getFullYear().toString()

Given('the supplier is on the login page', () => {
  cy.clearAllCookies()
  cy.clearAllLocalStorage()
  cy.clearAllSessionStorage()
  cy.visit('/')
  cy.getByDataTest('login-container').should('exist')
})

When('the supplier logs in with valid credentials', () => {
  cy.loginWith(
    'becid',
    Cypress.env('BCEID_TEST_USER'),
    Cypress.env('BCEID_TEST_PASS')
  )
  cy.visit('/')
  cy.getByDataTest('dashboard-container').should('exist')
})

When('the supplier navigates to the compliance reports page', () => {
  cy.get('a[href="/compliance-reporting"]').click()
})

When('the supplier creates a new compliance report', () => {
  cy.get('.MuiStack-root > :nth-child(1) > .MuiButtonBase-root').click()
  // Select and click the current year button
  cy.contains('.MuiList-root li', currentYear).click()
})

Then('the compliance report introduction is shown', () => {
  // Assert the header
  cy.get('[data-test="compliance-report-header"]')
    .should('be.visible')
    .and('have.text', `${currentYear} Compliance report - Original Report`)

  // Assert the status
  cy.get('[data-test="compliance-report-status"]')
    .should('be.visible')
    .and('have.text', 'Status: Draft')

  // Assert the Introduction Header
  cy.contains('div.MuiTypography-h5', 'Introduction')
    .should('be.visible')
    .and('have.text', 'Introduction')

  // Assert the Welcome Message
  cy.contains(
    'h6',
    'Welcome to the British Columbia Low Carbon Fuel Standard Portal'
  )
    .should('be.visible')
    .and(
      'have.text',
      'Welcome to the British Columbia Low Carbon Fuel Standard Portal'
    )
})
