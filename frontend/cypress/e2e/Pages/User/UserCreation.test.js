import {
  Given,
  When,
  Then,
  After
} from '@badeball/cypress-cucumber-preprocessor'

Given('the IDIR user is on the login page', () => {
  cy.clearAllCookies()
  cy.clearAllLocalStorage()
  cy.clearAllSessionStorage()
  cy.visit('/')
  cy.getByDataTest('login-container').should('exist')
})

When('the IDIR user logs in with valid credentials', () => {
  cy.loginWith(
    'idir',
    Cypress.env('admin_idir_username'),
    Cypress.env('admin_idir_password')
  )
  cy.setIDIRRoles('analyst')
  cy.visit('/')
  cy.getByDataTest('dashboard-container').should('exist')
})

When('the IDIR user navigates to the user creation page', () => {
    cy.get('a[href="/admin"]').click()
    cy.url().should('include', '/admin/users')
    cy.contains('New user').click()
    cy.url().should('include', '/admin/users/add-user')
})

When('the IDIR user fills out the form with valid data', () => {
    cy.get('input[id="firstName"]').type('John')
    cy.get('input[id="lastName"]').type('Doe')
    cy.get('input[id="jobTitle"]').type('Senior Analyst')
    cy.get('input[id="userName"]').type('johndoe')
    cy.get('input[id="keycloakEmail"]').type('john.doe@example.com')
    cy.get('input[id="phone"]').type('1234567890')
    cy.get('input[id="mobilePhone"]').type('0987654321')

    // Select the Analyst role
    cy.get('input[type="radio"][value="analyst"]').check()
})

When('the IDIR user submits the form', () => {
    cy.get('button[data-test="saveUser"]').click()
})

Then('a success message is displayed', () => {
    cy.get("[data-test='alert-box'] .MuiBox-root").should(
        'contain',
        'User has been successfully saved.'
    )
})

Then('the new user appears in the user list', () => {
    cy.visit('/admin/users')
    cy.contains('a', Cypress.env('john.doe@example.com')).should('be.visible')
})

// Test for validation error
When('the IDIR user fills out the form with invalid data', () => {
  // Missing username
  cy.get('input[id="firstName"]').type('John')
  cy.get('input[id="lastName"]').type('Doe')
  cy.get('input[id="jobTitle"]').type('Senior Analyst')
  cy.get('input[id="keycloakEmail"]').type('john.doe@example.com')
  cy.get('input[id="phone"]').type('1234567890')
  cy.get('input[id="mobilePhone"]').type('0987654321')

  // Select the Analyst role
  cy.get('input[type="radio"][value="analyst"]').check()
})

Then('an error message is displayed for validation', () => {
    cy.get('#userName-helper-text').should('contain', 'User name is required')
})

// Cleanup after the test
After(() => {
  cy.logout()
})
