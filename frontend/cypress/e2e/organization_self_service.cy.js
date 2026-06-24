/**
 * BCeID organization self-service pages — E2E suite (#4092).
 *
 * Covers the supplier-facing /organization/* routes: org profile, users list,
 * add user, and credit ledger, plus role-based visibility (BCeID users only see
 * their own org and the 3 supplier tabs).
 *
 * Logs in once as a BCeID supplier (real Keycloak, via the existing loginWith
 * helper) and stubs the per-page data endpoints with cy.intercept for
 * deterministic, seed-independent runs — matching the login+intercept pattern
 * used by the other authed specs. The supplier's own org id is supplied by the
 * real session, so the `pathname` matchers below accept any numeric org id.
 */

const BCEID_USER =
  Cypress.env('ORG1_BCEID_USERNAME') || Cypress.env('BCEID_TEST_USER')
const BCEID_PASS =
  Cypress.env('ORG1_BCEID_PASSWORD') || Cypress.env('BCEID_TEST_PASS')

// --- Stubbed responses -------------------------------------------------------

const ORG = {
  organizationId: 1,
  name: 'Test Fuel Supplier Inc.',
  operatingName: 'Test Fuel Supplier',
  email: 'contact@testfuel.example.com',
  phone: '250-555-0100',
  edrmsRecord: 'EDRMS-123',
  recordsAddress: '123 Records Way, Victoria, BC V8V 1A1',
  hasEarlyIssuance: false,
  creditTradingEnabled: true,
  organizationStatusId: 2,
  organizationTypeId: 1,
  orgStatus: { organizationStatusId: 2, status: 'Registered' },
  orgType: {
    organizationTypeId: 1,
    orgType: 'fuel_supplier',
    description: 'Fuel supplier',
    isBceidUser: true
  },
  orgAddress: {
    streetAddress: '123 Main St',
    addressOther: 'Suite 100',
    city: 'Victoria',
    provinceState: 'BC',
    country: 'Canada',
    postalcodeZipcode: 'V8V 1A1'
  },
  orgAttorneyAddress: {
    streetAddress: '456 Law Ave',
    addressOther: '',
    city: 'Vancouver',
    provinceState: 'BC',
    country: 'Canada',
    postalcodeZipcode: 'V6V 2B2'
  }
}

const ORG_BALANCE = {
  organizationId: 1,
  totalBalance: 5000,
  reservedBalance: 200,
  registered: true
}

const USERS_LIST = {
  users: [
    {
      userProfileId: 42,
      firstName: 'Jane',
      lastName: 'Doe',
      keycloakEmail: 'jane.doe@testfuel.example.com',
      phone: '250-555-0123',
      isActive: true,
      roles: [{ name: 'Signing Authority' }],
      organization: { organizationId: 1 }
    },
    {
      userProfileId: 43,
      firstName: 'John',
      lastName: 'Roe',
      keycloakEmail: 'john.roe@testfuel.example.com',
      phone: '250-555-0124',
      isActive: true,
      roles: [{ name: 'Read Only' }],
      organization: { organizationId: 1 }
    }
  ],
  pagination: { total: 2, page: 1, size: 10 }
}

const LEDGER_YEARS = ['2024', '2023', '2022']

const LEDGER = {
  ledger: [
    {
      compliancePeriod: '2024',
      availableBalance: 5000,
      complianceUnits: 1000,
      transactionType: 'Transfer',
      description: '',
      updateDate: '2024-05-01'
    },
    {
      compliancePeriod: '2023',
      availableBalance: 4000,
      complianceUnits: -200,
      transactionType: 'ComplianceReport',
      description: '2023 annual report',
      updateDate: '2023-12-15'
    }
  ],
  pagination: { page: 1, size: 10, total: 2, totalPages: 1 }
}

// Org details + balances are read on several pages; match any numeric org id.
const stubOrg = () => {
  cy.intercept({ method: 'GET', pathname: /\/organizations\/\d+$/ }, { body: ORG }).as('org')
  cy.intercept(
    { method: 'GET', pathname: /\/organizations\/current\/balances$/ },
    { body: ORG_BALANCE }
  ).as('currentBalance')
  cy.intercept(
    { method: 'GET', pathname: /\/organizations\/balances\/\d+$/ },
    { body: ORG_BALANCE }
  ).as('balances')
}

describe('BCeID organization self-service pages (#4092)', () => {
  before(() => {
    cy.loginWith('bceid', BCEID_USER, BCEID_PASS)
    cy.get('.main-layout-navbar', { timeout: 30000 }).should('be.visible')
  })

  beforeEach(() => {
    cy.on('uncaught:exception', () => false)
  })

  after(() => {
    cy.logout()
  })

  describe('Organization profile', () => {
    it('loads the org profile with the organization data', () => {
      stubOrg()
      cy.visit('/organization')
      cy.wait('@org')
      cy.contains(ORG.name).should('be.visible')
      cy.contains(ORG.operatingName).should('exist')
    })
  })

  describe('Role-based visibility', () => {
    it('shows only the 3 supplier tabs (no IDIR-only tabs)', () => {
      stubOrg()
      cy.visit('/organization')
      cy.wait('@org')

      cy.get('[role="tab"]', { timeout: 15000 }).should('have.length', 3)
      cy.contains('[role="tab"]', 'Dashboard').should('be.visible')
      cy.contains('[role="tab"]', 'Users').should('be.visible')
      cy.contains('[role="tab"]', 'Credit ledger').should('be.visible')
      // IDIR-only tabs must not be available to a supplier.
      cy.contains('[role="tab"]', 'Company overview').should('not.exist')
      cy.contains('[role="tab"]', 'Penalty log').should('not.exist')
      cy.contains('[role="tab"]', 'Supply history').should('not.exist')
      cy.contains('[role="tab"]', 'Compliance tracking').should('not.exist')
    })

    it('redirects an IDIR org route back to the supplier’s own org', () => {
      stubOrg()
      // A supplier hitting another org's IDIR route is bounced to /organization.
      cy.visit('/organizations/9999')
      cy.url({ timeout: 15000 }).should('match', /\/organization$/)
    })
  })

  describe('Organization users', () => {
    it('lists the organization users', () => {
      stubOrg()
      cy.intercept(
        { method: 'POST', pathname: /\/organization\/\d+\/users\/list$/ },
        { body: USERS_LIST }
      ).as('usersList')

      cy.visit('/organization/users')
      cy.wait('@usersList')
      cy.getByDataTest('bc-grid-container', { timeout: 15000 }).should('be.visible')
      cy.contains('.ag-cell', 'Jane Doe').should('be.visible')
    })
  })

  describe('Add user', () => {
    it('adds a new user to the organization', () => {
      // The create POST routes to /organization/:orgID/users (not /users/list).
      cy.intercept(
        { method: 'POST', pathname: /\/organization\/\d+\/users$/ },
        { statusCode: 201, body: { userProfileId: 99 } }
      ).as('createUser')

      cy.visit('/organization/add-user')
      cy.get('#user-form', { timeout: 20000 }).should('be.visible')

      cy.get('#firstName').type('New')
      cy.get('#lastName').type('Supplier User')
      cy.get('#userName').type('newsupplieruser')
      cy.get('#keycloakEmail').type('new.user@testfuel.example.com')

      cy.getByDataTest('saveUser').click()
      cy.wait('@createUser')
      // On success the form redirects back to the org dashboard.
      cy.url({ timeout: 15000 }).should('match', /\/organization$/)
    })
  })

  describe('Credit ledger', () => {
    it('loads the credit ledger with transaction data', () => {
      stubOrg()
      cy.intercept(
        { method: 'GET', pathname: /\/credit-ledger\/organization\/\d+\/years$/ },
        { body: LEDGER_YEARS }
      ).as('ledgerYears')
      cy.intercept(
        { method: 'POST', pathname: /\/credit-ledger\/organization\/\d+$/ },
        { body: LEDGER }
      ).as('ledgerList')

      cy.visit('/organization/credit-ledger')
      cy.wait('@ledgerList')
      cy.getByDataTest('bc-grid-container', { timeout: 15000 }).should('be.visible')
      cy.contains('.ag-header-cell-text', 'Compliance year').should('be.visible')
      cy.contains('.ag-cell', 'Transfer').should('exist')
      cy.contains('Available credit balance').should('be.visible')
    })
  })
})
