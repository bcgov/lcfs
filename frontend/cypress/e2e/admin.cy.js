describe('Admin view happy paths', () => {
  const idirUsername = Cypress.env('ADMIN_IDIR_USERNAME')
  const idirPassword = Cypress.env('ADMIN_IDIR_PASSWORD')

  beforeEach(() => {
    cy.loginWith('idir', idirUsername, idirPassword)
  })

  afterEach(() => {
    cy.logout()
  })

  it('allows administrators to open the add user form from the user list', () => {
    cy.visit('/admin/users', { timeout: 30000 })
    cy.getByDataTest('add-user-btn', { timeout: 30000 }).should('be.visible')
    cy.getByDataTest('bc-grid-container', { timeout: 30000 }).should('exist')
    cy.getByDataTest('add-user-btn').click()
    cy.url().should('include', '/admin/users/add-user')
    cy.getByDataTest('saveUser', { timeout: 30000 }).should('exist')
  })

  it('switches between admin tabs and loads the related grids', () => {
    const tabs = [
      { label: 'User activity', path: '/admin/user-activity', panelIndex: 1 },
      {
        label: 'User login history',
        path: '/admin/user-login-history',
        panelIndex: 2
      },
      { label: 'Audit log', path: '/admin/audit-log', panelIndex: 3 }
    ]

    cy.visit('/admin/users', { timeout: 30000 })

    tabs.forEach(({ label, path, panelIndex }) => {
      cy.contains('[role="tab"]', label, { timeout: 10000 }).click()
      cy.location('pathname', { timeout: 30000 }).should('eq', path)
      cy.get(
        `#full-width-AdminTabPanel-${panelIndex} [data-test="bc-grid-container"]`,
        { timeout: 30000 }
      ).should('be.visible')
    })
  })
})
