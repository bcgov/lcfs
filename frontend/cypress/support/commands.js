/**
 * Command to select elements using 'data-test' attribute.
 *
 * @param {string} selector - The 'data-test' attribute value to target.
 * @param {...any} args - Additional arguments for 'cy.get()'.
 * @returns A Cypress chainable object
 */
Cypress.Commands.add("getByDataTest", (selector, ...args) => {
    return cy.get(`[data-test=${selector}]`, ...args);
});

/**
 * Logs in a user (IDIR or BCeID) with provided credentials.
 *
 * @param {string} userType - 'idir' or 'bceid'.
 * @param {string} username - Username
 * @param {string} password - Password
 */
Cypress.Commands.add('login', (userType, username, password) => {
    cy.visit('/');

    // Determine which login link to click based on user type
    cy.getByDataTest(userType === 'idir' ? 'link-idir' : 'link-bceid').click();

    // Define the login process for IDIR and BCeID
    const loginProcess = (args) => {
        const [username, password] = args;
        cy.get('input[name=user]').type(username, { log: false });
        cy.get('input[name=password]').type(password, { log: false });
        cy.get('form').submit();
    };

    // Perform login on the appropriate page
    cy.origin('https://logontest7.gov.bc.ca', { args: [username, password] }, loginProcess);

    // Check to confirm successful login
    cy.getByDataTest('logout').should('be.visible');
});

/**
 * Logs out the user
 */
Cypress.Commands.add('logout', () => {
    cy.getByDataTest('logout-button').should('be.visible').click();

    // Verify successful logout
    cy.getByDataTest('login-container').should('exist');
});
