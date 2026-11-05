/* oxlint-disable cypress/unsafe-to-chain-command */

type CucumberRoleTable = { raw: () => string[][] }
type BCeIDRoles = string[] | CucumberRoleTable
type ElementQueryOptions = Partial<Cypress.Loggable & Cypress.Timeoutable>
const isInputElement = (
  element: HTMLElement
): element is HTMLInputElement | HTMLTextAreaElement =>
  element.tagName === 'INPUT' || element.tagName === 'TEXTAREA'

const isWritableInput = (
  element: HTMLElement
): element is HTMLInputElement | HTMLTextAreaElement =>
  isInputElement(element) && !element.readOnly

declare global {
  namespace Cypress {
    interface Chainable {
      getByDataTest(
        selector: string,
        options?: ElementQueryOptions
      ): Chainable<JQuery<HTMLElement>>
      loginWith(
        userType: 'idir' | 'bceid',
        username: string,
        password: string
      ): Chainable<unknown>
      logout(): Chainable<unknown>
      setBCeIDRoles(
        userType: string,
        roles: BCeIDRoles,
        id?: string
      ): Chainable<unknown>
      setIDIRRoles(role: string): Chainable<unknown>
      selectWithRetry(
        cellSelector: string,
        optionSelector: string,
        index: number,
        attempts?: number
      ): Chainable<unknown>
      inputTextWithRetry(
        cellSelector: string,
        inputValue: string | number,
        index: number,
        attempts?: number
      ): Chainable<unknown>
    }
  }
}

export {}

/**
 * Command to select elements using 'data-test' attribute.
 *
 * @param {string} selector - The 'data-test' attribute value to target.
 * @returns A Cypress chainable object
 */
Cypress.Commands.add('getByDataTest', (selector, options) => {
  return cy.get(`[data-test=${selector}]`, options)
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
  const loginSelector =
    userType === 'idir'
      ? '[data-test=public-login-idir], [data-test=link-idir]'
      : '[data-test=public-login-bceid], [data-test=link-bceid]'
  cy.get(loginSelector, { timeout: 30000 }).first().click()
  const loginProcess = (args: [username: string, password: string]) => {
    const [username, password] = args

    cy.on('uncaught:exception', () => {
      // Return false to ignore exceptions in case wrong credentials or account lock issues.
      return false
    })

    cy.get('input[name=user]').type(username, { log: false })
    cy.get('input[name=password]').type(password, { log: false })
    cy.get('form').submit()
    cy.wait('@loginRequest', { timeout: 30000 }).then(({ response }) => {
      const token = response?.body?.access_token
      if (typeof token !== 'string') {
        throw new Error('Login response did not include an access token')
      }
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
  cy.get('[data-test=login-container], [data-test=public-login-bceid]', {
    timeout: 30000
  }).should('exist')
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
    const bceidUsername = String(
      Cypress.env(`${userType}_username`.toLocaleUpperCase())
    )
    const organizationMatch = bceidUsername.match(/\d+/)
    if (!organizationMatch) {
      throw new Error(`Could not find an organization ID in ${bceidUsername}`)
    }
    const orgID = parseInt(organizationMatch[0], 10)
    cy.contains('a', `LCFS Org ${orgID}`).should('be.visible').click()
    cy.contains('a', 'tfrs@gov.bc.ca').should('be.visible').click()
    cy.get('#edit-user-button').click()
    cy.url().should('include', '/edit-user')

    // Process the roles array
    const userRoles = Array.isArray(roles) ? roles : (roles.raw()[0] ?? [])

    const rolesToCheck = userRoles.map((role) =>
      role.toLowerCase().replace(/\s/g, '-')
    )

    // First make sure the form is fully loaded
    cy.get('#user-form', { timeout: 30000 }).should('be.visible')

    // Handle each checkbox
    cy.get('input[type="checkbox"]').each(($checkbox) => {
      const checkboxId = $checkbox.attr('id')

      if (checkboxId && rolesToCheck.includes(checkboxId)) {
        // If the checkbox ID is in the array, check the checkbox
        cy.wrap($checkbox).check({ force: true })
      } else {
        // If the checkbox ID is not in the array, uncheck the checkbox
        cy.wrap($checkbox).uncheck({ force: true })
      }
    })

    // Submit the form
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
    function attemptSelection(attemptsLeft: number) {
      cy.get(cellSelector, { timeout: 20000 })
        .eq(index)
        .scrollIntoView()
        .click({ force: true })
        .then(() => {
          cy.get('body').then(($body) => {
            const hasOption = $body.find(optionSelector).length > 0
            if (hasOption) {
              cy.get(optionSelector, { timeout: 10000 })
                .first()
                .scrollIntoView()
                .click({ force: true })
              cy.wait(300)
              return
            }

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
      // Single click is enough because singleClickEdit: true is set on the grid
      cy.get(cellSelector, { timeout: 20000 })
        .eq(index)
        .scrollIntoView()
        .click({ force: true })

      // Give React time to mount the cell editor
      cy.wait(500)

      cy.get('body').then(($body) => {
        // AsyncSuggestionEditor can be rendered in slightly different DOM shapes
        // depending on browser/headed mode.
        const $asyncInput = $body.find(
          [
            '[data-testid="ag-grid-editor-select-options"] input',
            '#async-search-editor input',
            'input[placeholder*="search a name"]',
            'input[aria-autocomplete="list"]'
          ].join(', ')
        )
        // Inline editors (NumberEditor, agTextCellEditor) live inside the cell
        const $inlineInput = $body
          .find(cellSelector)
          .eq(index)
          .find('input, textarea')
          .filter((_, el) => isWritableInput(el))
        const $activeInput = $body
          .find(':focus')
          .filter('input, textarea')
          .filter((_, el) => isWritableInput(el))

        if ($asyncInput.length > 0) {
          // AsyncSuggestionEditor has no getValue(); commit via Tab which
          // calls api.tabToNextCell() and persists the typed value.
          cy.wrap($asyncInput.first())
            .click({ force: true })
            .clear({ force: true })
            .type(String(inputValue), { force: true })
            .trigger('keydown', {
              key: 'Tab',
              code: 'Tab',
              which: 9,
              keyCode: 9,
              bubbles: true
            })
        } else if ($inlineInput.length > 0) {
          // Standard inline editors (NumberEditor, agTextCellEditor) commit on Enter.
          cy.wrap($inlineInput.first())
            .clear({ force: true })
            .type(`${inputValue}{enter}`, { force: true })
        } else if ($activeInput.length > 0) {
          // In headed/open mode AG Grid sometimes focuses an editor outside the cell subtree.
          cy.wrap($activeInput.first())
            .clear({ force: true })
            .type(`${inputValue}{enter}`, { force: true })
        } else if (attemptsLeft > 0) {
          // Second activation strategy: some AG-Grid editors only mount after dblclick
          // in interactive/headed runs.
          cy.get(cellSelector, { timeout: 20000 })
            .eq(index)
            .scrollIntoView()
            .dblclick({ force: true })

          cy.wait(400)

          cy.get('body').then(($retryBody) => {
            const $retryAsyncInput = $retryBody.find(
              [
                '[data-testid="ag-grid-editor-select-options"] input',
                '#async-search-editor input',
                'input[placeholder*="search a name"]',
                'input[aria-autocomplete="list"]'
              ].join(', ')
            )

            const $retryInlineInput = $retryBody
              .find(cellSelector)
              .eq(index)
              .find('input, textarea')
              .filter((_, el) => isWritableInput(el) && !el.disabled)

            if ($retryAsyncInput.length > 0) {
              cy.wrap($retryAsyncInput.first())
                .click({ force: true })
                .clear({ force: true })
                .type(String(inputValue), { force: true })
                .trigger('keydown', {
                  key: 'Tab',
                  code: 'Tab',
                  which: 9,
                  keyCode: 9,
                  bubbles: true
                })
            } else if ($retryInlineInput.length > 0) {
              cy.wrap($retryInlineInput.first())
                .clear({ force: true })
                .type(`${inputValue}{enter}`, { force: true })
            } else {
              attemptsLeft--
              cy.wait(500).then(() => {
                tryInput()
              })
            }
          })
        } else {
          throw new Error(
            `❌ Failed to find input in selector ${cellSelector} after all attempts`
          )
        }
      })
    }

    cy.on('uncaught:exception', () => false)

    tryInput()
  }
)
