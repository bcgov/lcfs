describe('Admin view happy paths', { testIsolation: true }, () => {
  beforeEach(() => {
    cy.loginWithEnv('idir')
  })

  it('allows administrators to open the add user form from the user list', () => {
    cy.visit('/admin/users')
    cy.getByDataTest('add-user-btn', { timeout: 20000 }).should('be.visible')
    cy.getByDataTest('bc-grid-container', { timeout: 20000 }).should(
      'be.visible'
    )
    cy.getByDataTest('add-user-btn').click()
    cy.location('pathname').should('eq', '/admin/users/add-user')
    cy.getByDataTest('saveUser', { timeout: 20000 }).should('be.visible')
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

    cy.visit('/admin/users')
    cy.getByDataTest('bc-grid-container', { timeout: 20000 }).should(
      'be.visible'
    )

    tabs.forEach(({ label, path, panelIndex }) => {
      cy.contains('[role="tab"]', label, { timeout: 20000 })
        .should('be.visible')
        .click()
      cy.location('pathname', { timeout: 20000 }).should('eq', path)
      cy.get(
        `#full-width-AdminTabPanel-${panelIndex} [data-test="bc-grid-container"]`,
        { timeout: 20000 }
      ).should('be.visible')
    })
  })
})
