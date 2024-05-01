/**
 * Command to select elements using 'data-test' attribute.
 *
 * @param {string} selector - The 'data-test' attribute value to target.
 * @param {...any} args - Additional arguments for 'cy.get()'.
 * @returns A Cypress chainable object
 */
Cypress.Commands.add('getByDataTest', (selector, ...args) => {
  return cy.get(`[data-test=${selector}]`, ...args)
})

/**
 * Logs in a user (IDIR or BCeID) with provided credentials.
 *
 * @param {string} userType - 'idir' or 'bceid'.
 * @param {string} username - Username
 * @param {string} password - Password
 */
Cypress.Commands.add('loginWith', (userType, username, password) => {
  // Determine which login link to click based on user type
  cy.getByDataTest(userType === 'idir' ? 'link-idir' : 'link-bceid').click()

  // Define the login process for IDIR and BCeID
  const loginProcess = (args) => {
    const [username, password] = args
    cy.get('input[name=user]').type(username, { log: false })
    cy.get('input[name=password]').type(password, { log: false })
    cy.get('form').submit()
  }

  // Perform login on the appropriate page
  cy.origin(
    'https://logontest7.gov.bc.ca',
    { args: [username, password] },
    loginProcess
  )

  // Check to confirm successful login
  // cy.getByDataTest('logout-button').should('be.visible')
})

/**
 * Logs out the user
 */
Cypress.Commands.add('logout', () => {
  // Click the visible or hidden logout button
  cy.getByDataTest('logout-button').click({ force: true })

  cy.clearAllCookies()
  cy.clearAllLocalStorage()
  cy.clearAllSessionStorage()

  // Verify successful logout
  cy.getByDataTest('login-container').should('exist')
})

Cypress.Commands.add('setBCeIDRoles', (userType, roles, id = 'idirLogin') => {
  cy.session(id, () => {
    cy.visit('/')
    cy.getByDataTest('login-container').should('exist')
    // Login as an IDIR user with Admin privileges.
    cy.loginWith(
      'idir',
      Cypress.env('admin_idir_username'),
      Cypress.env('admin_idir_password')
    )
    cy.wait(5000)
    // If BCeID user then update the roles using the IDIR user
    cy.visit(
      `/organizations/${Cypress.env(`${userType}_id`)}/${Cypress.env(
        `${userType}_userId`
      )}/edit-user`
    )

    let userRoles = roles
    if (!Array.isArray(roles)) {
      userRoles = roles.raw()[0]
    }

    const rolesToCheck = userRoles.map((role) =>
      role.toLowerCase().replace(/\s/g, '-')
    )
    cy.get('input[type="checkbox"]').each(($checkbox) => {
      const checkboxId = $checkbox.attr('id')
      if (checkboxId && rolesToCheck.includes(checkboxId)) {
        // If the checkbox ID is in the array, check the checkbox
        cy.wrap($checkbox).check()
      } else {
        // If the checkbox ID is not in the array, uncheck the checkbox
        cy.wrap($checkbox).uncheck()
      }
    })
    cy.get('#user-form').submit()
    cy.logout()
  })
})
