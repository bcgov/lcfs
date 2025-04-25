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
  cy.clearAllCookies()
  cy.clearAllLocalStorage()
  cy.clearAllSessionStorage()
  cy.visit('/', { timeout: 60000 })
  // Determine which login link to click based on user type
  cy.intercept(
    'POST',
    'https://dev.loginproxy.gov.bc.ca/auth/realms/standard/protocol/openid-connect/token'
  ).as('loginRequest')
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
    cy.wait('@loginRequest', { timeout: 30000 }).then(({ response }) => {
      const token = response.body.access_token
      cy.wrap(token).as('authToken')
    })
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
  cy.getByDataTest('login-container', { timeout: 30000 }).should('exist')
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
    cy.get('a.NavLink[href="/organizations"]').should('be.visible').click()
    const bceidUsername = Cypress.env(
      `${userType}_username`.toLocaleUpperCase()
    )
    const orgID = parseInt(bceidUsername.match(/\d+/)[0])
    cy.contains('a', `LCFS Org ${orgID}`).should('be.visible').click()
    cy.contains('a', 'tfrs@gov.bc.ca').should('be.visible').click()
    cy.get('#edit-user-button').click()
    cy.url().should('include', '/edit-user')
    let userRoles = roles
    if (!Array.isArray(roles)) {
      userRoles = roles.raw()[0]
    }

    const rolesToCheck = userRoles.map((role) =>
      role.toLowerCase().replace(/\s/g, '-')
    )
    cy.get('#user-form', { timeout: 30000 })
      .get('input[type="checkbox"]')
      .each(($checkbox) => {
        const checkboxId = $checkbox.attr('id')
        const isChecked = $checkbox.is('checked')
        if (checkboxId && rolesToCheck.includes(checkboxId)) {
          // If the checkbox ID is in the array, check the checkbox
          if (!isChecked) {
            cy.wrap($checkbox).check()
          }
        } else {
          // If the checkbox ID is not in the array, uncheck the checkbox
          if (isChecked) {
            cy.wrap($checkbox).uncheck()
          }
        }
      })
    cy.get('#user-form').submit()
    cy.logout()
  })
})

Cypress.Commands.add('setIDIRRoles', (role) => {
  // Roles ['analyst', 'compliance manager', 'director']
  cy.visit('/admin/users', { timeout: 30000 })

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
    let attemptsLeft = attempts

    function tryInput() {
      // Click the body to deselect anything
      cy.get('body').click(50, 50, { force: true })

      cy.get(cellSelector, { timeout: 20000 })
        .eq(index)
        .scrollIntoView()
        .click({ force: true })
        .wait(300)
        .get(cellSelector)
        .eq(index)
        .find('input')
        .then(($input) => {
          if ($input.length > 0) {
            cy.wrap($input)
              .clear({ force: true })
              .type(`${inputValue}{enter}`, { force: true })
          } else if (attemptsLeft > 0) {
            attemptsLeft--
            cy.wait(500).then(() => {
              tryInput() // Retry again safely inside Cypress queue
            })
          } else {
            throw new Error(
              `❌ Failed to find input in selector ${cellSelector} after all attempts`
            )
          }
        })
    }

    // Handle any uncaught exceptions globally (optional)
    cy.on('uncaught:exception', (_err, runnable) => {
      return false
    })

    tryInput()
  }
)
