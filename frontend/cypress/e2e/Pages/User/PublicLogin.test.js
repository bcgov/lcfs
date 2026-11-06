import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor'

Given('I open the LCFS login page', () => {
  cy.visit('/login')
})

Then('I see the BCeID and IDIR sign-in options', () => {
  cy.getByDataTest('login-container').should('be.visible')
  cy.contains('button', 'Login with BCeID').should('be.visible')
  cy.contains('button', 'Login with IDIR').should('be.visible')
})

When('I open a protected organization route', () => {
  cy.visit('/organizations')
})

Then('I am redirected to the login page', () => {
  cy.location('pathname').should('eq', '/login')
  cy.getByDataTest('login-container').should('be.visible')
})
