import { After, Before, Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';

Given("I am on home page logged in as {string} user having roles", (userType, roles) => {
  // uncomment later.
  if (userType.includes("bceid")) {
      cy.setBCeIDRoles(userType, roles)
  }
  cy.clearAllCookies()
  cy.clearAllLocalStorage()
  cy.clearAllSessionStorage()
  cy.visit('/')
  cy.getByDataTest('login-container').should('exist')
  // Login with the updated user
  cy.loginWith("bceid", Cypress.env(`${userType}_username`), Cypress.env(`${userType}_password`))
  cy.wait(5000)
  cy.getByDataTest('dashboard-container').should('exist')
})

When("I transfer {string} units to organization {string} of value {string} with agreement date {string}", (qty, orgId, pricePerUnit, agreementDate) => {
  cy.get('a[href="/transactions"]').click();
  cy.get('#new-transfer-button').click()
  cy.get("[data-testid='quantity']").type(qty);
  cy.get("#to-organization-id").click()
  cy.get(`[data-value="${orgId}"]`).click();
  cy.get("#price-per-unit").type(pricePerUnit);
  cy.get("[data-testid='transfer-total-value']").invoke('text').then((text) => {
    expect(text).to.contain(`${(parseInt(qty) * parseFloat(pricePerUnit)).toLocaleString('en-CA', {
      style: 'currency',
      currency: 'CAD'
    })} CAD.`)
  })
  cy.get("[data-testid='transfer-agreement-date-input']").type(agreementDate);
})

When("add the {string} and save as draft", (comment) => {
  cy.get("#external-comments").type(comment);
  cy.get("#save-draft-btn").click()
  cy.get('[data-test="alert-box"] .MuiBox-root').should('contain', 'Draft transfer successfully created.');
  cy.wait(1000)
})

Then("I should see a draft transfer with {string} units having cost of {string} per unit sent to organization {string}.", (qty, pricePerUnit, orgId) => {
  cy.url().should('match', /transfers\/edit\/\d+$/);
  // check for visible buttons
  cy.get('#delete-draft-btn').should('exist');
  cy.get('#save-draft-btn').should('exist');
  cy.get("#sign-and-send-btn")
    .should('exist')
    .and('be.disabled');
})

When("delete the transfer", () => {
  cy.get("#delete-draft-btn").click()
  cy.get('.MuiDialog-container').should('exist')
    .and('contain', 'Are you sure you want to delete this draft?');
  cy.get('#modal-btn-delete-draft').click()
  cy.get('[data-test="alert-box"] .MuiBox-root').should('contain', 'Transfer successfully deleted')
})

When("sign and send the draft transfer", () => {
  cy.get('#signing-authority-declaration').click();
  cy.get("#sign-and-send-btn").click()
  cy.get('.MuiDialog-container').should('exist')
    .and('contain', 'Are you sure you want to sign and send this transfer to');
  cy.get('#modal-btn-sign-and-send').click()
  cy.wait(1000)
  cy.get("[data-test='alert-box']").should('contain', 'Transfer successfully sent')
})

When("sign and send the transfer", () => {
  cy.get('#signing-authority-declaration').click();
  cy.get("#sign-and-send-btn").click()
  cy.get('.MuiDialog-container').should('exist')
    .and('contain', 'Are you sure you want to sign and send this transfer to');
  cy.get('#modal-btn-sign-and-send').click()
  cy.get("[data-test='alert-box'] .MuiBox-root").should('contain', 'Transfer successfully sent.')
  cy.wait(1000)
})

Then("I should be redirected to transactions page.", () => {
  cy.url().should('match', /transactions$/);
})


After(() => {
  // Code to run after all tests have completed
  console.log("All tests have completed.");
});