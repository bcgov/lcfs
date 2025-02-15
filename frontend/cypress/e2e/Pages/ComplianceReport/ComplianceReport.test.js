import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'

const currentYear = new Date().getFullYear().toString()

Given('the user is on the login page', () => {
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

When('they navigate to the compliance reports page', () => {
  cy.get('a[href="/compliance-reporting"]').click()
})

When('the supplier creates a new compliance report', () => {
  cy.get('.MuiStack-root > :nth-child(1) > .MuiButtonBase-root').click()
  // Select and click the current year button
  cy.contains('.MuiList-root li', currentYear).click()
})

When('the supplier navigates to the fuel supply page', () => {
  cy.get(
    '[data-test="schedule-list"] > :nth-child(1) > .MuiTypography-root'
  ).click()

  cy.contains('.MuiTypography-h5', 'Supply of fuel').should('be.visible')
})

When('the supplier enters a valid fuel supply row', () => {
  // First, ensure the grid is loaded
  cy.get('.ag-root').should('be.visible')

  cy.wait(1000)

  // Set "Fuel type" to "CNG"
  cy.get('div[col-id="fuelType"][title="Select the fuel type from the list"]')
    .click()
    .find('input')
    .type('Ethanol{enter}')

  cy.wait(800)

  // Set "Determining carbon intensity" to "Default carbon intensity - section 19 (b) (ii)"
  cy.get(
    'div[col-id="provisionOfTheAct"][title="Act Relied Upon to Determine Carbon Intensity: Identify the appropriate provision of the Act relied upon to determine the carbon intensity of each fuel."]'
  ).click()
  cy.get(
    '[data-testid="select-Default carbon intensity - section 19 (b) (ii)"]'
  ).click()

  cy.get('body').click()
  cy.wait(700)
  cy.get('.ag-body-horizontal-scroll-viewport').scrollTo(1000, 0)
  cy.wait(1200)

  // Set "Quantity" to "10,000"
  cy.get('div.ag-cell[col-id="quantity"]')
    .click()
    .wait(1200)
    .find('input')
    .type('10000{enter}')

  cy.contains('Row updated successfully.').should('be.visible')
})

When('saves and returns to the report', () => {
  cy.get('.MuiButton-contained').click()

  cy.get('[data-test="compliance-report-status"]')
    .should('be.visible')
    .and('have.text', 'Status: Draft')
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
  cy.contains('div.MuiTypography-h6', 'Introduction')
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

Then('the compliance report summary includes the quantity', () => {
  cy.wait(2000)
  cy.get(
    '[data-test="renewable-summary"] > .MuiTable-root > .MuiTableBody-root > :nth-child(2) > :nth-child(3) > span'
  )
    .should('be.visible')
    .and('have.text', '10,000')

  cy.get(
    '[data-test="renewable-summary"] > .MuiTable-root > .MuiTableBody-root > :nth-child(3) > :nth-child(3) > span'
  )
    .should('be.visible')
    .and('have.text', '10,000')

  cy.get(
    '[data-test="renewable-summary"] > .MuiTable-root > .MuiTableBody-root > :nth-child(4) > :nth-child(3) > span'
  )
    .should('be.visible')
    .and('have.text', '500')
})

When('the supplier fills out line 6', () => {
  cy.get(
    '[data-test="renewable-summary"] > .MuiTable-root > .MuiTableBody-root > :nth-child(6) > :nth-child(3)'
  )
    .find('input')
    .type('50{enter}')
    .blur()
})

Then('it should round the amount to 25', () => {
  cy.get(
    '[data-test="renewable-summary"] > .MuiTable-root > .MuiTableBody-root > :nth-child(6) > :nth-child(3)'
  )
    .find('input')
    .should('be.visible')
    .and('have.value', '25')
})

When('the supplier accepts the agreement', () => {
  cy.get('#signing-authority-declaration').click()
})

When('the supplier submits the report', () => {
  cy.contains('button', 'Submit report').click()
  cy.get('#modal-btn-submit-report').click()
  cy.wait(2000)
})

Then('the banner shows success', () => {
  // Assert the Submitted Message
  cy.contains('div', 'Compliance report successfully submitted').should(
    'be.visible'
  )
})

Then('they see the previously submitted report', () => {
  cy.get('.ag-column-first > a > .MuiBox-root')
    .should('be.visible')
    .and('have.text', currentYear)
})
