import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'

Given('the analyst logs in with valid credentials', () => {
  cy.loginWith(
    'idir',
    Cypress.env('ADMIN_IDIR_USERNAME'),
    Cypress.env('ADMIN_IDIR_PASSWORD')
  )
  cy.wait(5000)
  cy.setIDIRRoles('analyst')
  cy.visit('/')
  cy.getByDataTest('dashboard-container').should('exist')
})

When('the analyst navigates to the transactions page', () => {
  cy.get('a[href="/transactions"]').click()
  cy.wait(5000)
})

When('the analyst selects a transaction', () => {
  cy.get('div[row-index="0"]').click()
  cy.wait(5000)
})

When('the analyst recommends the transaction', () => {
  cy.get('#recommend-btn').click()
  cy.get('.MuiDialog-container')
    .should('exist')
    .and(
      'contain',
      'Are you sure you want to recommend this initiative agreement?'
    )
  cy.wait(500)
  cy.get('#modal-btn-recommend').click()
})

Then('a success message for recommendation is displayed', () => {
  cy.get("[data-test='alert-box'] .MuiBox-root").should(
    'contain',
    'Initiative agreement successfully recommended'
  )
})

When('the analyst starts a new initiative agreement transaction', () => {
  cy.get('#new-transaction-button').click()
  cy.get('#txnType').within(() => {
    cy.get('input[type="radio"][value="initiativeAgreement"]').click()
  })
})

When(
  'the analyst enters {string} units to organization {string} with effective date {string} and comment {string}',
  (units, orgId, effectiveDate, comment) => {
    cy.get('#to-organization-id').click()
    cy.get(`[data-value="${orgId}"]`).click()
    cy.get('input[name="complianceUnits"]').type(units)
    cy.get('input[name="transactionEffectiveDate"]').type(effectiveDate)
    cy.get(':nth-child(2) > :nth-child(5)').click()
    cy.get('textarea[name="govComment"]').type(comment)
  }
)

When('the analyst saves the draft transaction', () => {
  cy.get('#save-draft-btn').click()
  cy.wait(1000)
})

Then('a success message for saving draft is displayed', () => {
  cy.get('[data-test="alert-box"] .MuiBox-root').should(
    'contain',
    'Draft initiative agreement successfully created.'
  )
})

Then('the draft transaction is in edit mode', () => {
  cy.url().should('match', /initiative-agreement\/edit\/\d+$/)
  cy.get('#delete-draft-btn').should('exist')
  cy.get('#save-draft-btn').should('exist')
  cy.get('#recommend-btn').should('exist')
})

Given('the director is on the login page', () => {
  cy.visit('/')
  cy.getByDataTest('login-container').should('exist')
})

When('the director logs in with valid credentials', () => {
  cy.loginWith(
    'idir',
    Cypress.env('ADMIN_IDIR_USERNAME'),
    Cypress.env('ADMIN_IDIR_PASSWORD')
  )
  cy.wait(5000)
  cy.getByDataTest('dashboard-container').should('exist')
  cy.setIDIRRoles('director')
  cy.visit('/')
})

When('the director selects a recommended transaction', () => {
  cy.get('a[href="/transactions"]').click()
  cy.wait(5000)
  cy.get('div[row-index="0"]').click()
  cy.wait(5000)
})

When('the director approves the transaction', () => {
  cy.get('#approve-btn').should('exist')
  cy.get('#approve-btn').click()
  cy.get('.MuiDialog-container')
    .should('exist')
    .and(
      'contain',
      'Are you sure you want to approve this initiative agreement?'
    )
  cy.wait(500)
  cy.get('#modal-btn-approve').click()
})

Then('a success message for approval is displayed', () => {
  cy.get("[data-test='alert-box'] .MuiBox-root").should(
    'contain',
    'Initiative agreement successfully approved'
  )
})
