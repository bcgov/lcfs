/**
 * Public Credit Calculator & Calculation Data lookup table — E2E suite (#4089).
 *
 * The compliance unit calculator (/credit-calculator) and the calculation data
 * lookup table (/calculation-data) are the program's only unauthenticated,
 * public-facing pages. They are served by <CalculatorMenu /> under
 * <PublicPageLayout /> with no auth guard, so these specs never log in.
 *
 * The calculator API endpoints (`/calculator/...`) are public. We stub them with
 * cy.intercept so the bidirectional calculation flow is exercised
 * deterministically and independently of seeded reference data — matching the
 * intercept-stub convention already used by the notifications/organization
 * specs in this folder.
 */

// --- Stubbed API responses (shapes mirror what the components consume) -------

// useGetCompliancePeriodList -> response.data is an array of { description }
const compliancePeriodsFixture = [
  { description: '2030' },
  { description: '2026' },
  { description: '2025' },
  { description: '2024' },
  { description: '2023' } // < 2024: filtered out of the calculator dropdown
]

// useGetFuelTypeList -> response.data is an array of fuel types for a category
const fuelTypeListFixture = [
  { fuelType: 'Biodiesel', fuelTypeId: 2, fuelCategoryId: 1 }
]

// useGetFuelTypeOptions -> response.data. A single end use and a single base
// provision so they auto-select, keeping the calculation flow deterministic.
const fuelTypeOptionsFixture = {
  unit: 'L',
  energyDensity: { unit: { name: 'MJ/L' } },
  eerRatios: [{ endUseType: { type: 'Any', endUseTypeId: 1 } }],
  provisions: [{ name: 'Default carbon intensity - section 19 (b) (ii)' }],
  fuelCodes: []
}

// useCalculateComplianceUnits -> response.data (quantity -> compliance units)
const calculateFixture = {
  complianceUnits: 1234,
  tci: 90.5,
  eer: 1.0,
  rci: 20.0,
  uci: 0,
  energyContent: 3700000,
  energyDensity: 37,
  quantity: 100000
}

// useCalculateQuantityFromComplianceUnits -> response.data (units -> quantity)
const quantityFixture = {
  quantity: 42000,
  complianceUnits: 500,
  tci: 90.5,
  eer: 1.0,
  rci: 20.0,
  uci: 0,
  energyContent: 1554000,
  energyDensity: 37
}

// useGetLookupTableData -> response.data.data is the array of rows
const lookupTableFixture = {
  data: [
    {
      fuelType: 'Biodiesel',
      fuelCategory: 'Diesel',
      endUse: 'Any',
      determiningCarbonIntensity: 'Default carbon intensity - section 19 (b) (ii)',
      targetCi: 79.28,
      ciOfFuel: 20.5,
      uci: 0,
      eer: 1.0,
      energyDensity: 37.0,
      energyDensityUnit: 'MJ/L'
    },
    {
      fuelType: 'Ethanol',
      fuelCategory: 'Gasoline',
      endUse: 'Any',
      determiningCarbonIntensity: 'Default carbon intensity - section 19 (b) (ii)',
      targetCi: 88.83,
      ciOfFuel: 40.2,
      uci: 0,
      eer: 1.0,
      energyDensity: 23.58,
      energyDensityUnit: 'MJ/L'
    }
  ]
}

// --- Intercept helpers -------------------------------------------------------

// `pathname` regexes match the request path only (ignoring the `/api` base
// prefix and any query string), so they are robust to CONFIG.API_BASE.
const stubCalculatorApi = () => {
  cy.intercept(
    { method: 'GET', pathname: /\/calculator\/compliance-periods$/ },
    { body: compliancePeriodsFixture }
  ).as('compliancePeriods')

  cy.intercept(
    { method: 'GET', pathname: /\/calculator\/[^/]+\/$/ },
    { body: fuelTypeListFixture }
  ).as('fuelTypes')

  cy.intercept(
    { method: 'GET', pathname: /\/calculator\/[^/]+\/fuel-type-options\/$/ },
    { body: fuelTypeOptionsFixture }
  ).as('fuelTypeOptions')

  // Reverse calc (`.../calculate/quantity/`) is registered after the forward
  // calc so it takes precedence for its more specific path.
  cy.intercept(
    { method: 'GET', pathname: /\/calculator\/[^/]+\/calculate\/$/ },
    { body: calculateFixture }
  ).as('calculate')

  cy.intercept(
    { method: 'GET', pathname: /\/calculator\/[^/]+\/calculate\/quantity\/$/ },
    { body: quantityFixture }
  ).as('calculateQuantity')

  cy.intercept(
    { method: 'GET', pathname: /\/calculator\/[^/]+\/lookup-table\/$/ },
    { body: lookupTableFixture }
  ).as('lookupTable')
}

// Drive the cascading selections up to the point where end use + provision
// auto-select and the calculator is ready to compute.
const selectDieselBiodiesel = () => {
  cy.get('input[type="radio"][value="Diesel"]').check({ force: true })
  cy.wait('@fuelTypes')
  cy.get('input[type="radio"][value="Biodiesel"]', { timeout: 15000 })
    .should('exist')
    .check({ force: true })
  cy.wait('@fuelTypeOptions')
  // Single end use + single base provision auto-select.
  cy.get('input[type="radio"][value="Any"]', { timeout: 15000 }).should(
    'be.checked'
  )
}

describe('Public Credit Calculator and Calculation Data (#4089)', () => {
  context('Compliance unit calculator', () => {
    beforeEach(() => {
      // Public page; swallow unrelated app-shell init errors.
      cy.on('uncaught:exception', () => false)
      stubCalculatorApi()
      cy.visit('/credit-calculator')
      cy.wait('@compliancePeriods')
    })

    it('loads without authentication', () => {
      cy.url().should('include', '/credit-calculator')
      // The protected login screen must never appear on a public page.
      cy.getByDataTest('login-container').should('not.exist')
      cy.contains('Compliance unit calculator').should('be.visible')
      cy.get('#compliance-year').should('exist')
      cy.getByDataTest('quantity').should('exist')
    })

    it('cascades dropdowns: compliance year → fuel category → fuel type → end use/provision', () => {
      // Choose a compliance year via the MUI select.
      cy.get('#compliance-year').click()
      cy.get('li[data-value="2025"]', { timeout: 10000 }).click()
      cy.get('#compliance-year').should('contain', '2025')

      // Fuel type is not available until a category is chosen.
      cy.get('input[type="radio"][value="Biodiesel"]').should('not.exist')
      cy.get('input[type="radio"][value="Diesel"]').check({ force: true })
      cy.wait('@fuelTypes')

      // Category → fuel type now populated.
      cy.get('input[type="radio"][value="Biodiesel"]', { timeout: 15000 })
        .should('exist')
        .check({ force: true })
      cy.wait('@fuelTypeOptions')

      // Fuel type → end use + provision now populated (and auto-selected).
      cy.get('input[type="radio"][value="Any"]', { timeout: 15000 }).should(
        'exist'
      )
      cy.get(
        'input[type="radio"][value="Default carbon intensity - section 19 (b) (ii)"]'
      ).should('be.checked')
    })

    it('calculates compliance units from a supplied quantity', () => {
      selectDieselBiodiesel()
      // Default quantity (100,000) drives the forward calculation.
      cy.wait('@calculate')
      cy.getByDataTest('quantity').should('have.value', '100,000')
      cy.getByDataTest('complianceUnits', { timeout: 15000 }).should(
        'have.value',
        '1,234'
      )
    })

    it('reverse-calculates quantity from compliance units', () => {
      selectDieselBiodiesel()
      cy.wait('@calculate')

      // Typing into compliance units switches to reverse mode.
      cy.getByDataTest('complianceUnits')
        .clear({ force: true })
        .type('500', { force: true })
      cy.wait('@calculateQuantity')
      cy.getByDataTest('quantity', { timeout: 15000 }).should(
        'have.value',
        '42,000'
      )
    })

    it('accepts a custom carbon intensity for applicable provisions', () => {
      selectDieselBiodiesel()

      // A request carrying useCustomCi=true gets a distinct response so we can
      // assert both the request shape and the rendered result.
      cy.intercept(
        {
          method: 'GET',
          pathname: /\/calculator\/[^/]+\/calculate\/$/,
          query: { useCustomCi: 'true' }
        },
        { body: { ...calculateFixture, complianceUnits: 999 } }
      ).as('customCalculate')

      // Switch the provision to the "custom CI" option.
      cy.get('input[type="radio"][value="customCi"]').check({ force: true })

      // The custom CI input becomes editable.
      cy.get('#carbon-intensity-input', { timeout: 15000 })
        .should('exist')
        .should('not.be.disabled')
        .clear({ force: true })
        .type('85.50', { force: true })

      cy.wait('@customCalculate').its('request.query.useCustomCi').should('eq', 'true')
      cy.getByDataTest('complianceUnits', { timeout: 15000 }).should(
        'have.value',
        '999'
      )
    })
  })

  context('Calculation data lookup table', () => {
    beforeEach(() => {
      cy.on('uncaught:exception', () => false)
      stubCalculatorApi()
      cy.visit('/calculation-data')
      cy.wait('@lookupTable')
    })

    it('loads the lookup table with reference data', () => {
      cy.url().should('include', '/calculation-data')
      cy.getByDataTest('login-container').should('not.exist')
      cy.contains('Calculation data').should('be.visible')

      // Both stubbed reference rows render in the grid.
      cy.get('.ag-center-cols-container .ag-row', { timeout: 15000 }).should(
        'have.length',
        2
      )
      cy.contains('.ag-cell', 'Biodiesel').should('exist')
      cy.contains('.ag-cell', 'Ethanol').should('exist')
    })

    it('displays the expected reference columns (CI, TCI, EER, energy density)', () => {
      // The CI-related columns cluster on the right; scroll the grid so they
      // render past AG Grid's column virtualisation.
      cy.get('.ag-center-cols-viewport', { timeout: 15000 }).scrollTo('right', {
        ensureScrollable: false
      })

      cy.contains('.ag-header-cell-text', 'Target CI', { timeout: 10000 }).should(
        'be.visible'
      ) // TCI
      cy.contains('.ag-header-cell-text', 'CI of fuel').should('be.visible') // CI
      cy.contains('.ag-header-cell-text', 'EER').should('be.visible')
      cy.contains('.ag-header-cell-text', 'Energy density').should('be.visible')
    })
  })
})
