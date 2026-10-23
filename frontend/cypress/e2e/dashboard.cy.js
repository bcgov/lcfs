describe('Dashboard view coverage', () => {
  beforeEach(() => {
    cy.loginWithEnv('idir')
    cy.setIDIRRoles('director')
    cy.visit('/', { timeout: 30000 })
    cy.getByDataTest('dashboard-container', { timeout: 30000 }).should('exist')
  })

  afterEach(() => {
    cy.logout()
  })

  it('navigates through the admin links card to user management', () => {
    cy.getByDataTest('dashboard-admin-links-card', {
      timeout: 30000
    }).should('be.visible')
    cy.getByDataTest('admin-link-admin-users', { timeout: 30000 })
      .should('be.visible')
      .click()
    cy.location('pathname', { timeout: 30000 }).should('eq', '/admin/users')
  })

  it('allows directors to enter government notification edit mode', () => {
    cy.getByDataTest('dashboard-government-notifications-card', {
      timeout: 30000
    }).should('be.visible')
    cy.get('#edit-government-notification', { timeout: 30000 })
      .should('be.visible')
      .click()
    cy.get('.ql-editor', { timeout: 30000 }).should('be.visible')
    cy.contains('button', 'Cancel', { timeout: 10000 }).click()
    cy.get('#edit-government-notification').should('exist')
  })
})
