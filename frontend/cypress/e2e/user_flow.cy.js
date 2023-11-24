/**
 * User Login Test Suite.
 * This suite includes tests for both IDIR and BCeID login flows,
 * verifying login page load, successful login, and logout functionality.
 */

describe('User Login Test Suite', () => {
    beforeEach(function () {
        cy.visit('/')
    })

    it('verifies that the login page loads correctly', () => {
        cy.getByDataTest('login-container').should('exist');
    });

    describe('IDIR Login Flow', () => {
        it('completes login with IDIR user credentials', () => {
            cy.login('idir', Cypress.env('IDIR_TEST_USER'), Cypress.env('IDIR_TEST_PASS'));
        });

        it('executes logout functionality for IDIR user', () => {
            cy.login('idir', Cypress.env('IDIR_TEST_USER'), Cypress.env('IDIR_TEST_PASS'));
            cy.logout();
        });
    });

    describe('BCeID Login Flow', () => {
        it('completes login with BCeID user credentials', () => {
            cy.login('bceid', Cypress.env('BCEID_TEST_USER'), Cypress.env('BCEID_TEST_PASS'));
        });

        it('executes logout functionality for BCeID user', () => {
            cy.login('bceid', Cypress.env('BCEID_TEST_USER'), Cypress.env('BCEID_TEST_PASS'));
            cy.logout();
        });
    });
});
