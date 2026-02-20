const notificationsFixture = {
  notifications: [
    {
      notificationMessageId: 9876,
      isRead: false,
      type: 'Transfer',
      message: JSON.stringify({
        id: 'TR-123',
        service: 'Transfer',
        compliancePeriod: '2024'
      }),
      createDate: '2024-05-01T12:00:00Z',
      relatedTransactionId: 'TR-123',
      originUserProfile: { fullName: 'LCFS System' },
      relatedOrganization: { name: 'Demo Organization' }
    }
  ],
  pagination: { page: 1, size: 10, total: 1 }
}

const analystSubscriptionFixture = [
  {
    notificationChannelSubscriptionId: 456,
    notificationTypeName: 'IDIR_ANALYST__TRANSFER__SUBMITTED_FOR_REVIEW',
    notificationChannelName: 'EMAIL',
    isEnabled: true
  }
]

describe('Notifications view flows', () => {
  const idirUsername = Cypress.env('ADMIN_IDIR_USERNAME')
  const idirPassword = Cypress.env('ADMIN_IDIR_PASSWORD')

  beforeEach(() => {
    cy.loginWith('idir', idirUsername, idirPassword)
  })

  afterEach(() => {
    cy.logout()
  })

  it('supports selecting notifications and executing bulk actions', () => {
    cy.intercept('POST', '/notifications/list', {
      statusCode: 200,
      body: notificationsFixture
    }).as('fetchNotifications')
    cy.intercept('PUT', '/notifications/', (req) => {
      req.reply({ statusCode: 200, body: {} })
    }).as('markNotifications')
    cy.intercept('DELETE', '/notifications/', (req) => {
      req.reply({ statusCode: 200, body: {} })
    }).as('deleteNotifications')

    cy.visit('/notifications')
    cy.wait('@fetchNotifications')

    cy.getByDataTest('select-all').click()
    cy.getByDataTest('mark-as-read').should('not.be.disabled').click()
    cy.wait('@markNotifications')
      .its('request.body')
      .should('deep.equal', { applyToAll: true })
    cy.wait('@fetchNotifications')

    // Toggle to clear and reapply selection for delete flow
    cy.getByDataTest('select-all').click()
    cy.getByDataTest('select-all').click()

    cy.getByDataTest('mark-as-unread').should('not.be.disabled').click()
    cy.wait('@deleteNotifications')
      .its('request.body')
      .should('deep.equal', { applyToAll: true })
    cy.wait('@fetchNotifications')
  })

  it('allows analysts to toggle notification subscription settings', () => {
    cy.setIDIRRoles('analyst')

    cy.intercept('GET', '/notifications/subscriptions', {
      statusCode: 200,
      body: analystSubscriptionFixture
    }).as('getSubscriptions')
    cy.intercept('POST', '/notifications/subscriptions/save', (req) => {
      req.reply({ statusCode: 200, body: {} })
    }).as('mutateSubscription')

    cy.visit('/notifications/configure')
    cy.wait('@getSubscriptions')

    const emailToggleSelector =
      'input[data-test="notification-toggle-IDIR_ANALYST__TRANSFER__SUBMITTED_FOR_REVIEW-email"]'

    cy.get(emailToggleSelector).should('be.checked')
    cy.get(emailToggleSelector).uncheck({ force: true })
    cy.wait('@mutateSubscription')
      .its('request.body')
      .should('deep.equal', {
        notificationChannelSubscriptionId: 456,
        deleted: true
      })
    cy.wait('@getSubscriptions')

    cy.get(emailToggleSelector).check({ force: true })
    cy.wait('@mutateSubscription')
      .its('request.body')
      .should('deep.equal', {
        notificationTypeName: 'IDIR_ANALYST__TRANSFER__SUBMITTED_FOR_REVIEW',
        notificationChannelName: 'EMAIL',
        isEnabled: true
      })
    cy.wait('@getSubscriptions')
  })
})
