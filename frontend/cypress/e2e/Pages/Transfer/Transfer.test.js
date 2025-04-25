import {
  After,
  Before,
  Given,
  When,
  Then
} from '@badeball/cypress-cucumber-preprocessor'

Given(
  'I am on home page logged in as {string} user having roles',
  (userType, roles) => {
    if (userType.includes('bceid')) {
      cy.setBCeIDRoles(userType, roles)
    }
    cy.visit('/')
    cy.getByDataTest('login-container').should('exist')
    // Login with the updated user
    cy.loginWith(
      'bceid',
      Cypress.env(`${userType}_username`.toLocaleUpperCase()),
      Cypress.env(`${userType}_password`.toLocaleUpperCase())
    )
    cy.getByDataTest('dashboard-container', { timeout: 30000 }).should('exist')
  }
)

When(
  'I transfer {string} units to organization {string} of value {string} with agreement date {string}',
  (qty, orgId, pricePerUnit, agreementDate) => {
    cy.get('a[href="/transactions"]').click()
    cy.get('#new-transfer-button').click()
    cy.get("[data-test='quantity']").type(qty)
    cy.get('#to-organization-id').click()
    cy.get(`[data-value="${orgId}"]`).click()
    cy.get('#price-per-unit').type(pricePerUnit)
    cy.get("[data-test='transfer-total-value']")
      .invoke('text')
      .then((text) => {
        expect(text).to.contain(
          `${(parseInt(qty) * parseFloat(pricePerUnit)).toLocaleString(
            'en-CA',
            {
              style: 'currency',
              currency: 'CAD'
            }
          )} CAD.`
        )
      })
    cy.get("[data-test='transfer-agreement-date']").type(agreementDate)
  }
)

When('add the {string} and save as draft', (comment) => {
  cy.get('#external-comments').type(comment)
  cy.get('#save-draft-btn').click()
  cy.get('[data-test="alert-box"] .MuiBox-root').should(
    'contain',
    'Draft transfer successfully created.'
  )
  cy.wait(1000)
})

Then(
  'I should see a draft transfer with {string} units having cost of {string} per unit sent to organization {string}.',
  (qty, pricePerUnit, orgId) => {
    cy.url().should('match', /transfers\/edit\/\d+$/)
    // check for visible buttons
    cy.get('#delete-draft-btn').should('exist')
    cy.get('#save-draft-btn').should('exist')
    cy.get('#sign-and-send-btn').should('exist').and('be.disabled')
  }
)

When('delete the transfer', () => {
  cy.get('#delete-draft-btn').click()
  cy.get('.MuiDialog-container')
    .should('exist')
    .and('contain', 'Are you sure you want to delete this draft?')
  cy.get('#modal-btn-delete-draft').click()
  cy.get('[data-test="alert-box"] .MuiBox-root').should(
    'contain',
    'Transfer successfully deleted'
  )
})

When('sign and send the draft transfer', () => {
  cy.get('#signing-authority-declaration').click()
  cy.get('#sign-and-send-btn').click()
  cy.get('.MuiDialog-container')
    .should('exist')
    .and('contain', 'Are you sure you want to sign and send this transfer to')
  cy.get('#modal-btn-sign-and-send').click()
  cy.wait(500)
  cy.get("[data-test='alert-box']").should(
    'contain',
    'Transfer successfully sent'
  )
})

When('sign and send the transfer', () => {
  cy.get('#signing-authority-declaration').click()
  cy.get('#sign-and-send-btn').click()
  cy.get('.MuiDialog-container')
    .should('exist')
    .and('contain', 'Are you sure you want to sign and send this transfer to')
  cy.get('#modal-btn-sign-and-send').click()
  cy.get("[data-test='alert-box'] .MuiBox-root").should(
    'contain',
    'Transfer successfully sent'
  )
  cy.wait(500)
})

Then('I should be redirected to transactions page.', () => {
  cy.url().should('match', /transactions\/\?hid=transfer-\d+$/)
})

Given('bceid transfer accounts are setup with roles', () => {
  cy.setBCeIDRoles('org1_bceid', ['Transfer', 'Signing authority'], 'idir1')
  cy.setBCeIDRoles('org2_bceid', ['Transfer', 'Signing authority'], 'idir2')

  cy.loginWith(
    'bceid',
    Cypress.env('ORG1_BCEID_USERNAME'),
    Cypress.env('ORG1_BCEID_PASSWORD')
  )
  cy.wait(5000)
  cy.getByDataTest('dashboard-container').should('exist')
})

When('I logout', () => {
  cy.logout()
})

When('I login as receiving org and submit', () => {
  cy.visit('/')
  cy.getByDataTest('login-container').should('exist')
  // Login with the updated user
  cy.loginWith(
    'bceid',
    Cypress.env('org2_bceid_username'),
    Cypress.env('org2_bceid_password')
  )
  cy.wait(5000)
  cy.getByDataTest('dashboard-container').should('exist')

  cy.get('a[href="/transactions"]').click()
  cy.wait(5000)
  cy.get('div[row-index="0"]').click()
  cy.get('#signing-authority-declaration').click()
  cy.get('#sign-and-submit-btn').click()
  cy.get('.MuiDialog-container')
    .should('exist')
    .and('contain', 'Are you sure you want to sign and submit this transfer to')
  cy.wait(500)
  cy.get('#modal-btn-sign-and-submit').click()
  cy.get("[data-test='alert-box'] .MuiBox-root").should(
    'contain',
    'Transfer successfully submitted'
  )
})

When('I login as analyst and recommend', () => {
  cy.visit('/')
  cy.getByDataTest('login-container').should('exist')
  // Login with the updated user
  cy.loginWith(
    'idir',
    Cypress.env('ADMIN_IDIR_USERNAME'),
    Cypress.env('ADMIN_IDIR_PASSWORD')
  )

  cy.wait(5000)
  cy.setIDIRRoles('analyst')
  cy.visit('/')
  cy.getByDataTest('dashboard-container').should('exist')

  cy.get('a[href="/transactions"]').click()
  cy.wait(5000)
  cy.get('div[row-index="0"]').click()
  cy.wait(5000)
  cy.get('label').contains('Recommend record').click()
  cy.get('#recommend-btn').click()
  cy.get('.MuiDialog-container')
    .should('exist')
    .and('contain', 'Are you sure you want to recommend this transfer?')
  cy.wait(500)
  cy.get('#modal-btn-recommend').click()
  cy.get("[data-test='alert-box'] .MuiBox-root").should(
    'contain',
    'Transfer successfully recommended'
  )
})

When('I login as director and records transfer', () => {
  cy.visit('/')
  cy.getByDataTest('login-container').should('exist')
  // Login with the updated user
  cy.loginWith(
    'idir',
    Cypress.env('ADMIN_IDIR_USERNAME'),
    Cypress.env('ADMIN_IDIR_PASSWORD')
  )
  cy.wait(5000)
  cy.setIDIRRoles('director')
  cy.visit('/')
  cy.getByDataTest('dashboard-container').should('exist')
  cy.get('a[href="/transactions"]').click()
  cy.wait(5000)
  cy.get('div[row-index="0"]').click()
  cy.wait(5000)
  cy.get('#record-btn').click()
  cy.get('.MuiDialog-container')
    .should('exist')
    .and('contain', 'Are you sure you want to record this transfer?')
  cy.wait(500)
  cy.get('#modal-btn-record-transfer').click()
  cy.get("[data-test='alert-box'] .MuiBox-root").should(
    'contain',
    'Transfer successfully recorded'
  )
})
When('I login as director and refuse transfer', () => {
  cy.visit('/')
  cy.getByDataTest('login-container').should('exist')
  // Login with the updated user
  cy.loginWith(
    'idir',
    Cypress.env('ADMIN_IDIR_USERNAME'),
    Cypress.env('ADMIN_IDIR_PASSWORD')
  )
  cy.wait(5000)
  cy.setIDIRRoles('director')
  cy.visit('/')
  cy.getByDataTest('dashboard-container').should('exist')

  cy.get('a[href="/transactions"]').click()
  cy.wait(5000)
  cy.get('div[row-index="0"]').click()
  cy.wait(5000)
  cy.get('#refuse-btn').click()
  cy.get('.MuiDialog-container')
    .should('exist')
    .and('contain', 'Are you sure you want to refuse this transfer?')
  cy.wait(500)
  cy.get('#modal-btn-refuse-transfer').click()
  cy.get("[data-test='alert-box'] .MuiBox-root").should(
    'contain',
    'Transfer successfully refused'
  )
})

Then(
  'I should be redirected to transactions page and transfer should have status {string}.',
  (status) => {
    cy.url()
      .should('match', /transactions\/\?hid=transfer-\d+$/)
      .then(async (url) => {
        const params = url.split('/?')[1].split('&')
        await cy.log(params)
        const paramObj = {}
        params.forEach((param) => {
          const [key, value] = param.split('=')
          paramObj[key] = value
        })

        return paramObj.hid
      })
      .then(async (transferID) => {
        await cy.get(`div[row-id=${transferID}]`).should('contain', status)
      })
  }
)

After(() => {
  // Code to run after all tests have completed
  console.log('All tests have completed.')
})
