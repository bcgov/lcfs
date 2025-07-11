/// <reference types="cypress" />
import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'

const SELECTORS = {
  dashboard: '#dashboard',
  returnToSupplierButton: 'button[data-test="return-report-supplier-btn"]',
  modalConfirmButton: '[data-test="modal-btn-primary"]',
  reportStatusCell: '.ag-cell[col-id="status"]',
  draftStatus: ':contains("Draft")',
  submittedStatus: ':contains("Submitted")'
}

// Get the current compliance year for testing
const currentComplianceYear = new Date().getFullYear() - 1

Given('the user is on the login page', () => {
  cy.visit('/', { timeout: 60000 })
})

Given('the analyst logs in with valid credentials for compliance reports', () => {
  cy.loginWith(
    'idir',
    Cypress.env('ADMIN_IDIR_USERNAME'),
    Cypress.env('ADMIN_IDIR_PASSWORD')
  )
  cy.wait(5000)
  cy.setIDIRRoles('analyst')
  cy.visit('/', { timeout: 60000 })
  cy.get(SELECTORS.dashboard).should('exist')
})

Given('they navigate to the compliance reports page', () => {
  cy.visit('/compliance-reporting')
  cy.wait(2000)
})

// This would need to be set up with test data or replaced by a direct API call
Given('they see a submitted supplemental report', () => {
  // This is a placeholder - in practice, you would need to ensure there's a supplemental report
  // in Submitted status, either by setting it up via API or ensuring it exists in the test environment
  cy.get('.ag-body-viewport').should('be.visible')
  cy.contains('.ag-cell', 'Supplemental').should('be.visible')
  cy.contains('.ag-cell', 'Submitted').should('be.visible')
})

Given('they click the report to view it', () => {
  cy.contains('.ag-cell', 'Supplemental').parent('.ag-row').find('a').click()
  cy.wait(2000)
})

When('the analyst clicks the "Return report to the supplier" button', () => {
  cy.waitAndClick(SELECTORS.returnToSupplierButton)
  cy.wait(1000)
})

When('the analyst confirms the return action', () => {
  cy.waitAndClick(SELECTORS.modalConfirmButton)
  cy.wait(2000)
})

Then('the supplemental report is set to Draft status', () => {
  // After returning, we should be redirected to the report list
  cy.url().should('include', '/compliance-reporting')
  cy.contains('.ag-cell', 'Supplemental')
    .parent('.ag-row')
    .find('.ag-cell[col-id="status"]')
    .should('contain', 'Draft')
})

Then('a success message is displayed for report return', () => {
  // The exact message will depend on your implementation - check actual UI
  cy.contains(/report.*returned|returned.*report/i).should('be.visible')
})

// For the supplier scenario
Given('the supplier logs in with valid credentials', () => {
  cy.loginWith(
    'bceid',
    Cypress.env('TEST_SUPPLIER_USERNAME'),
    Cypress.env('TEST_SUPPLIER_PASSWORD')
  )
  cy.wait(5000)
  cy.visit('/', { timeout: 60000 })
  cy.get(SELECTORS.dashboard).should('exist')
})

Then(
  'they see the previously returned supplemental report with Draft status',
  () => {
    cy.contains('.ag-cell', 'Supplemental')
      .parent('.ag-row')
      .find('.ag-cell[col-id="status"]')
      .should('contain', 'Draft')
  }
)

Then('they can edit and resubmit the report', () => {
  // Click on the report to open it
  cy.contains('.ag-cell', 'Supplemental').parent('.ag-row').find('a').click()
  cy.wait(2000)

  // Verify we can see the Submit button
  cy.get('button[data-test="submit-report-btn"]').should('be.visible')
})
