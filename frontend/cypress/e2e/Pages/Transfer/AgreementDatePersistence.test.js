import {
  After,
  Given,
  When,
  Then
} from '@badeball/cypress-cucumber-preprocessor'

const agreementDateInput = "[data-test='transfer-agreement-date-input']"

Given('the seeded org1 transfer user is logged in', () => {
  cy.loginWithEnv('org1_bceid')
  cy.getByDataTest('dashboard-container', { timeout: 30000 }).should('exist')
})

Given('a new draft transfer is open', function () {
  return cy
    .task('createDraftTransfer', { agreementDate: '2024-04-06' })
    .then((transferId) => {
      this.transferId = transferId
      return cy
        .visit(`/transfers/edit/${transferId}`)
        .then(() =>
          cy.get(agreementDateInput).should('have.value', '2024-04-06')
        )
    })
})

When(
  'I change the agreement date from {string} to {string} and save the draft',
  (originalDate, updatedDate) => {
    cy.get(agreementDateInput).should('have.value', originalDate)
    cy.get(agreementDateInput).clear()
    cy.get(agreementDateInput).type(updatedDate)
    cy.get('#save-draft-btn').click()
    cy.get('[data-test="alert-box"] .MuiBox-root').should(
      'contain',
      'Draft transfer successfully updated.'
    )
  }
)

Then(
  'the updated agreement date should persist after reopening the draft',
  () => {
    cy.location('pathname').then((pathname) => cy.visit(pathname))
    cy.get(agreementDateInput).should('have.value', '2024-04-07')
  }
)

After({ tags: '@agreement-date-persistence' }, function () {
  if (this.transferId) return cy.task('deleteTransfer', this.transferId)
})
