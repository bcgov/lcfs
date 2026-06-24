/**
 * IDIR Organization admin detail views — E2E suite (#4091).
 *
 * Covers the /organizations/:orgID/* sub-routes that an IDIR analyst/admin uses
 * to manage a fuel supplier: edit org, users list + user detail, credit ledger
 * (with filtering), company overview, penalty log + manage (add/edit), supply
 * history, and compliance tracking.
 *
 * These pages are government-only, so the suite logs in once as an IDIR admin
 * (real Keycloak) and stubs the per-page data endpoints with cy.intercept for
 * deterministic, seed-independent runs — matching the login+intercept pattern
 * already used by notifications.cy.js / organization.cy.js.
 *
 * All API paths are served under CONFIG.API_BASE (".../api"); the `pathname`
 * regex matchers below ignore that prefix and any query string.
 */

const ORG_ID = 1
const USER_ID = 42

// --- Stubbed responses (shapes mirror what each component consumes) ----------

const ORG = {
  organizationId: ORG_ID,
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
  },
  // Company overview fields (same GET feeds the company-overview tab).
  companyDetails: 'Operates two refineries in British Columbia.',
  companyRepresentationAgreements: 'Represented by counsel since 2020.',
  companyActingAsAggregator: 'No',
  companyAdditionalNotes: 'No additional notes.'
}

const ORG_BALANCE = {
  organizationId: ORG_ID,
  totalBalance: 5000,
  reservedBalance: 200,
  registered: true
}

const ORG_TYPES = [
  { organizationTypeId: 1, orgType: 'fuel_supplier', description: 'Fuel supplier', isBceidUser: true },
  { organizationTypeId: 2, orgType: 'aggregator', description: 'Aggregator', isBceidUser: true }
]

const USERS_LIST = {
  users: [
    {
      userProfileId: USER_ID,
      firstName: 'Jane',
      lastName: 'Doe',
      keycloakEmail: 'jane.doe@testfuel.example.com',
      phone: '250-555-0123',
      isActive: true,
      roles: [{ name: 'Signing Authority' }],
      organization: { organizationId: ORG_ID }
    },
    {
      userProfileId: 43,
      firstName: 'John',
      lastName: 'Roe',
      keycloakEmail: 'john.roe@testfuel.example.com',
      phone: '250-555-0124',
      isActive: true,
      roles: [{ name: 'Read Only' }],
      organization: { organizationId: ORG_ID }
    }
  ],
  pagination: { total: 2, page: 1, size: 10 }
}

const USER_DETAIL = {
  userProfileId: USER_ID,
  firstName: 'Jane',
  lastName: 'Doe',
  title: 'Compliance Manager',
  keycloakEmail: 'jane.doe@testfuel.example.com',
  phone: '250-555-0123',
  mobilePhone: '250-555-0199',
  isActive: true,
  isGovernmentUser: false,
  organization: { organizationId: ORG_ID, name: ORG.name },
  roles: [{ name: 'Signing Authority' }]
}

const USER_ACTIVITY = { activities: [], pagination: { total: 0, page: 1, size: 20 } }

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

const PENALTY_ANALYTICS = {
  yearlyPenalties: [
    { complianceYear: '2024', autoRenewable: 100, autoLowCarbon: 50, totalAutomatic: 150 }
  ],
  penaltyLogs: [{ complianceYear: '2024', penaltyAmount: 500 }],
  totals: {
    autoRenewable: 100,
    autoLowCarbon: 50,
    discretionary: 500,
    totalAutomatic: 150,
    total: 650
  }
}

const PENALTY_LOGS = {
  penaltyLogs: [
    {
      penaltyLogId: 7,
      complianceYear: '2024',
      contraventionType: 'Single contravention',
      offenceHistory: false,
      deliberate: false,
      effortsToCorrect: true,
      economicBenefitDerived: false,
      effortsToPreventRecurrence: true,
      notes: 'Late submission of annual report.',
      penaltyAmount: 500
    }
  ],
  pagination: { total: 1, page: 1, size: 10, totalPages: 1 }
}

const COMPLIANCE_PERIODS = [
  { compliancePeriodId: 6, description: '2024' },
  { compliancePeriodId: 5, description: '2023' }
]

const FUEL_SUPPLY = {
  fuelSupplies: [
    {
      compliancePeriod: '2024',
      reportSubmissionDate: '2024-05-01',
      fuelType: 'Biodiesel',
      fuelCategory: 'Diesel',
      provisionOfTheAct: 'Default carbon intensity - section 19 (b) (ii)',
      fuelCode: 'BCLCF123.0',
      fuelQuantity: 100000,
      units: 'L'
    }
  ],
  pagination: { page: 1, size: 10, total: 1 },
  analytics: {
    totalVolume: 100000,
    totalFuelTypes: 1,
    totalReports: 1,
    mostRecentSubmission: '2024-05-01',
    totalByYear: { 2024: 100000 },
    totalByFuelType: { Biodiesel: 100000 },
    totalByFuelCategory: { Diesel: 100000 },
    totalByProvision: { 'Default carbon intensity': 100000 }
  }
}

// --- Intercept helpers -------------------------------------------------------

// Shell requests fired by OrganizationView on every detail route.
const stubShell = () => {
  cy.intercept({ method: 'GET', pathname: /\/organizations\/1$/ }, { body: ORG }).as('org')
  cy.intercept(
    { method: 'GET', pathname: /\/organizations\/balances\/1$/ },
    { body: ORG_BALANCE }
  ).as('balances')
}

describe('IDIR organization admin detail views (#4091)', () => {
  before(() => {
    cy.loginWith(
      'idir',
      Cypress.env('ADMIN_IDIR_USERNAME'),
      Cypress.env('ADMIN_IDIR_PASSWORD')
    )
    cy.get('.main-layout-navbar', { timeout: 30000 }).should('be.visible')
  })

  beforeEach(() => {
    cy.on('uncaught:exception', () => false)
  })

  after(() => {
    cy.logout()
  })

  describe('Edit organization', () => {
    it('opens the prefilled edit form and submits an update', () => {
      stubShell()
      cy.intercept(
        { method: 'GET', pathname: /\/organizations\/types\/?$/ },
        { body: ORG_TYPES }
      ).as('orgTypes')
      cy.intercept(
        { method: 'PUT', pathname: /\/organizations\/1$/ },
        { statusCode: 200, body: { organizationId: ORG_ID } }
      ).as('updateOrg')

      cy.visit(`/organizations/${ORG_ID}`)
      cy.wait('@org')
      cy.contains(ORG.name).should('be.visible')

      // Enter edit mode (Administrator-gated button).
      cy.get('#edit-org-button', { timeout: 20000 }).click()
      cy.getByDataTest('addEditOrgContainer').should('be.visible')

      // Form is prefilled from the org record.
      cy.get('#orgLegalName').should('have.value', ORG.name)
      cy.get('#orgOperatingName')
        .should('have.value', ORG.operatingName)
        .clear()
        .type('Updated Operating Name')

      cy.getByDataTest('saveOrganization').click()
      cy.wait('@updateOrg')
      cy.getByDataTest('alert-box').should('contain', 'successfully updated')
    })
  })

  describe('Organization users', () => {
    it('lists the organization users', () => {
      stubShell()
      cy.intercept(
        { method: 'POST', pathname: /\/organization\/1\/users\/list$/ },
        { body: USERS_LIST }
      ).as('usersList')

      cy.visit(`/organizations/${ORG_ID}/users`)
      cy.wait('@usersList')
      cy.getByDataTest('bc-grid-container', { timeout: 15000 }).should('be.visible')
      cy.contains('.ag-cell', 'Jane Doe').should('be.visible')
      cy.contains('.ag-cell', 'jane.doe@testfuel.example.com').should('exist')
    })

    it('opens an individual user detail page', () => {
      stubShell()
      cy.intercept(
        { method: 'POST', pathname: /\/organization\/1\/users\/list$/ },
        { body: USERS_LIST }
      ).as('usersList')
      cy.intercept(
        { method: 'GET', pathname: /\/users\/42$/ },
        { body: USER_DETAIL }
      ).as('userDetail')
      cy.intercept(
        { method: 'POST', pathname: /\/users\/42\/activity$/ },
        { body: USER_ACTIVITY }
      ).as('userActivity')

      cy.visit(`/organizations/${ORG_ID}/users`)
      cy.wait('@usersList')
      cy.contains('.ag-cell', 'Jane Doe').click()

      cy.url().should('match', /\/organizations\/1\/users\/42$/)
      cy.wait('@userDetail')
      cy.getByDataTest('user-card', { timeout: 15000 }).should('be.visible')
      cy.contains('User details').should('be.visible')
      cy.contains('jane.doe@testfuel.example.com').should('be.visible')
    })
  })

  describe('Credit ledger', () => {
    it('renders the ledger and re-queries when filtered by year', () => {
      stubShell()
      cy.intercept(
        { method: 'GET', pathname: /\/credit-ledger\/organization\/1\/years$/ },
        { body: LEDGER_YEARS }
      ).as('ledgerYears')
      cy.intercept(
        { method: 'POST', pathname: /\/credit-ledger\/organization\/1$/ },
        { body: LEDGER }
      ).as('ledgerList')

      cy.visit(`/organizations/${ORG_ID}/credit-ledger`)
      cy.wait('@ledgerList')

      cy.getByDataTest('bc-grid-container', { timeout: 15000 }).should('be.visible')
      cy.contains('.ag-header-cell-text', 'Compliance year').should('be.visible')
      cy.contains('.ag-header-cell-text', 'Available balance').should('exist')
      cy.contains('Available credit balance').should('be.visible')

      // Filtering by a compliance year re-POSTs with a compliance_period filter.
      cy.get('[role="combobox"]').click()
      cy.get('.MuiMenuItem-root').contains('2023').click()
      cy.get('@ledgerList.all', { timeout: 15000 }).should((calls) => {
        const filtered = calls.some((c) =>
          (c.request.body.filters || []).some((f) => f.field === 'compliance_period')
        )
        expect(filtered, 'a year-filtered ledger request was sent').to.be.true
      })
    })
  })

  describe('Company overview', () => {
    it('renders the company overview content', () => {
      stubShell()
      cy.visit(`/organizations/${ORG_ID}/company-overview`)
      cy.wait('@org')
      cy.contains('Company overview').should('be.visible')
      cy.contains(ORG.companyDetails).should('be.visible')
    })
  })

  describe('Penalty log', () => {
    it('renders the penalty log with history', () => {
      stubShell()
      cy.intercept(
        { method: 'GET', pathname: /\/organizations\/1\/penalties\/analytics$/ },
        { body: PENALTY_ANALYTICS }
      ).as('penaltyAnalytics')
      cy.intercept(
        { method: 'POST', pathname: /\/organizations\/1\/penalties\/logs\/list$/ },
        { body: PENALTY_LOGS }
      ).as('penaltyLogs')

      cy.visit(`/organizations/${ORG_ID}/penalty-log`)
      cy.wait('@penaltyLogs')
      cy.contains('Penalty history').should('be.visible')
      cy.getByDataTest('bc-grid-container', { timeout: 15000 }).should('be.visible')
      cy.contains('.ag-cell', 'Single contravention').should('exist')
      cy.contains('button', 'Add/Edit discretionary penalties').should('be.visible')
    })

    it('opens the manage (add/edit) penalty editor', () => {
      stubShell()
      cy.intercept(
        { method: 'GET', pathname: /\/organizations\/1\/penalties\/analytics$/ },
        { body: PENALTY_ANALYTICS }
      ).as('penaltyAnalytics')
      cy.intercept(
        { method: 'POST', pathname: /\/organizations\/1\/penalties\/logs\/list$/ },
        { body: PENALTY_LOGS }
      ).as('penaltyLogs')
      cy.intercept(
        { method: 'GET', pathname: /\/reports\/compliance-periods$/ },
        { body: COMPLIANCE_PERIODS }
      ).as('compliancePeriods')

      cy.visit(`/organizations/${ORG_ID}/penalty-log`)
      cy.wait('@penaltyLogs')
      cy.contains('button', 'Add/Edit discretionary penalties').click()

      cy.url().should('match', /\/penalty-log\/manage$/)
      cy.contains('Confer discretionary penalty', { timeout: 15000 }).should('be.visible')
      cy.getByDataTest('save-btn').should('be.visible')

      // Adding a row expands the editable grid.
      cy.get('.ag-center-cols-container .ag-row').then(($rows) => {
        const before = $rows.length
        cy.getByDataTest('add-row-btn').click()
        cy.get('.ag-center-cols-container .ag-row').should(
          'have.length.greaterThan',
          before
        )
      })
    })
  })

  describe('Supply history', () => {
    it('loads the supply history page', () => {
      stubShell()
      cy.intercept(
        { method: 'POST', pathname: /\/fuel-supply\/organization\/1$/ },
        { body: FUEL_SUPPLY }
      ).as('fuelSupply')

      cy.visit(`/organizations/${ORG_ID}/supply-history`)
      cy.wait('@fuelSupply')
      cy.getByDataTest('bc-grid-container', { timeout: 15000 }).should('be.visible')
      cy.contains('.ag-cell', 'Biodiesel').should('exist')
    })
  })

  describe('Compliance tracking', () => {
    it('loads the compliance tracking page', () => {
      stubShell()
      cy.visit(`/organizations/${ORG_ID}/compliance-tracking`)
      cy.wait('@org')
      cy.contains('This section will contain compliance tracking information').should(
        'be.visible'
      )
    })
  })
})
