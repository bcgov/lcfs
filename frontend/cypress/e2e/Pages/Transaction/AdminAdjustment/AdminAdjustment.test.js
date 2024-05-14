
import { Before, Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';

// Shared Before hook for all scenarios
Before(() => {
  cy.loginAs('analyst'); // Assumed to handle login and set up user session.
});

Given('I am logged in as an {string} user', (role) => {
  cy.verifyUser(role); // This verifies the user role after login.
});

Given('I navigate to the {string} page', (page) => {
  cy.navigateToPage(page); // Custom command to handle navigation based on the page name.
});

When('I fill in the required fields for Admin Adjustment', () => {
  cy.get('#amount').type('1000');
  cy.get('#description').type('Test Admin Adjustment');
});

When('I submit the form as a draft', () => {
  cy.get('#save-draft-btn').click();
});

When('I modify the Admin Adjustment details', () => {
  cy.get('#amount').clear().type('2000');
  cy.get('#description').clear().type('Updated Admin Adjustment');
});

When('I approve the Admin Adjustment', () => {
  cy.get('#approve-button').click();
});

Then('I should see the transaction listed as a draft in the Admin Adjustment list', () => {
  cy.get('.admin-adjustment-list').should('contain', 'Test Admin Adjustment');
  cy.get('.admin-adjustment-list').should('contain', 'Draft');
});

Then('I should see the updated Admin Adjustment in the list', () => {
  cy.get('.admin-adjustment-list').should('contain', 'Updated Admin Adjustment');
  cy.get('.admin-adjustment-list').should('not.contain', 'Draft');
});

Then('the Admin Adjustment should have status {string}', (status) => {
  cy.get('.status-column').should('contain', status);
});
