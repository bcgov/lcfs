/* eslint-disable cypress/unsafe-to-chain-command */
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
  const loginProcess = (args) => {
    const [username, password] = args

    cy.on('uncaught:exception', (_err, runnable) => {
      // Return false to ignore exceptions in case wrong credentials or account lock issues.
      return false
    })

    console.log('username', username)
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
  cy.wait(5000)
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
    expect(Cypress.env('ADMIN_IDIR_USERNAME'), 'IDIR username is set').to.be.a(
      'string'
    ).and.not.be.empty
    cy.loginWith(
      'idir',
      Cypress.env('ADMIN_IDIR_USERNAME'),
      Cypress.env('ADMIN_IDIR_PASSWORD')
    )
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

Cypress.Commands.add('setIDIRRoles', (role) => {
  // Roles ['analyst', 'compliance manager', 'director']
  cy.visit('/admin/users')

  cy.wait(5000)

  // Find the row with the specified name and click it
  cy.contains('a', Cypress.env('ADMIN_IDIR_EMAIL')).should('be.visible').click()

  cy.url().should('match', /\/admin\/users\/\d+/)

  // click edit button
  cy.get('#edit-user-button').click()

  // Ensure the URL has changed to the user edit page
  cy.url().should('include', '/edit-user')

  const roleToSelect = role.toLowerCase()
  cy.get(`input[type="radio"][value="${roleToSelect}"]`).check()

  // Save the changes by clicking the button with data-test=saveUser
  cy.get('button[data-test="saveUser"]').click()

  cy.get("[data-test='alert-box'] .MuiBox-root").should(
    'contain',
    'User has been successfully saved.'
  )
})

Cypress.Commands.add(
  'selectWithRetry',
  (cellSelector, optionSelector, index, attempts = 3) => {
    function attemptSelection(attemptsLeft) {
      // Deselect anything
      cy.get('body').click(50, 50, { force: true })

      cy.get(cellSelector)
        .eq(index)
        .click()
        .then(() => {
          cy.get('body').then(($body) => {
            // Check if optionSelector exists in the DOM
            if ($body.find(optionSelector).length > 0) {
              cy.get(optionSelector).scrollIntoView().click()
              cy.wait(300)
            } else {
              // If optionSelector not found, start process from cellSelector again
              cy.log(
                `Option selector not found. Starting from cell selector again. Attempts left: ${attemptsLeft}`
              )
              if (attemptsLeft > 0) {
                cy.wait(500)
                attemptSelection(attemptsLeft - 1) // Retry from cellSelector
              } else {
                throw new Error(
                  `Failed to find selector after all attempts ${cellSelector}`
                )
              }
            }
          })
        })
    }

    attemptSelection(attempts)
  }
)

Cypress.Commands.add(
  'inputTextWithRetry',
  (cellSelector, inputValue, index, attempts = 3) => {
    function attemptInput(attemptsLeft) {
      // Deselect anything
      cy.get('body').click(50, 50, { force: true })

      cy.get(cellSelector)
        .eq(index)
        .click()
        .then(($cell) => {
          cy.get('body').then(($body) => {
            // Check if input exists in the cell
            if ($cell.find('input').length > 0) {
              cy.wrap($cell).find('input').clear().type(`${inputValue}{enter}`)
              cy.wait(300)
            } else {
              // If input not found, retry the cell click
              cy.log(
                `Input field not found. Starting from cell selector again. Attempts left: ${attemptsLeft}`
              )
              if (attemptsLeft > 0) {
                cy.wait(500)
                attemptInput(attemptsLeft - 1) // Retry
              } else {
                throw new Error(
                  `Failed to find selector after all attempts ${cellSelector}`
                )
              }
            }
          })
        })
    }

    attemptInput(attempts)
  }
)
