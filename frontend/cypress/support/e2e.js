// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

import 'cypress-axe'
import 'cypress-real-events/support'
import 'cypress-react-selector'
import './commands'

// Suppress specific transient application exceptions that are unrelated to test
// correctness.  Returning false from this handler tells Cypress not to fail the
// current test.
//
// 1. Axios Network Error from KeycloakProvider.trackLogin – a best-effort auth
//    tracking XHR that can fail in local/CI environments with no consequence.
//
// 2. BCGridEditor.applyTransaction race – AG Grid fires a post-save transaction
//    after React has already unmounted the grid on navigation.  The save itself
//    completed successfully; this error is purely a cleanup-timing artefact.
Cypress.on('uncaught:exception', (err) => {
  const message = err?.message || ''
  const stack = err?.stack || ''

  const isTrackLoginError =
    message.includes('Network Error') &&
    stack.includes('axios') &&
    stack.includes('KeycloakProvider.jsx')

  const isGridTransactionRace =
    message.includes("Cannot read properties of undefined (reading 'applyTransaction')") &&
    stack.includes('BCGridEditor.jsx')

  if (isTrackLoginError || isGridTransactionRace) {
    return false
  }
})

cy.on('fail', (error, runnable) => {
  console.error(error)

  throw error
})

export const terminalLog = (violations) => {
  cy.task(
    'log',
    `${violations.length} accessibility violation${
      violations.length === 1 ? '' : 's'
    } ${violations.length === 1 ? 'was' : 'were'} detected`
  )
  // pluck specific keys to keep the table readable
  const violationData = violations.map(
    ({ id, impact, description, nodes }) => ({
      id,
      impact,
      description,
      nodes: nodes.length
    })
  )

  cy.task('table', violationData)
}
