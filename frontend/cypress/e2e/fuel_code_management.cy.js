/* eslint-disable cypress/unsafe-to-chain-command */

const idirCreds = () => ({
  username: Cypress.env('IDIR_TEST_USER') || Cypress.env('ADMIN_IDIR_USERNAME'),
  password: Cypress.env('IDIR_TEST_PASS') || Cypress.env('ADMIN_IDIR_PASSWORD')
})

const fuelCodeOptions = {
  fuelCodePrefixes: [
    {
      fuelCodePrefixId: 1,
      prefix: 'BCLCF',
      nextFuelCode: '102.5'
    }
  ],
  fuelTypes: [
    {
      fuelTypeId: 1,
      fuelType: 'Ethanol',
      fossilDerived: false,
      units: 'Litres'
    }
  ],
  fieldOptions: {
    feedstock: ['Corn'],
    feedstockLocation: ['Canada'],
    feedstockMisc: []
  },
  facilityNameplateCapacityUnits: ['Litres']
}

const existingFuelCode = {
  fuelCodeId: 901,
  prefixId: 1,
  prefix: 'BCLCF',
  fuelSuffix: '102.5',
  carbonIntensity: 42.15,
  edrms: 'EDRMS-901',
  company: 'Cypress Biofuels',
  contactName: 'Test Contact',
  contactEmail: 'fuel.codes@example.com',
  applicationDate: '2025-01-01',
  approvalDate: '2025-02-01',
  effectiveDate: '2025-03-01',
  expirationDate: '2028-03-01',
  fuelTypeId: 1,
  fuelType: 'Ethanol',
  feedstock: 'Corn',
  feedstockLocation: 'Canada',
  feedstockMisc: '',
  coProcessed: 'No',
  fuelProductionFacilityCity: 'Vancouver',
  fuelProductionFacilityProvinceState: 'British Columbia',
  fuelProductionFacilityCountry: 'Canada',
  feedstockFuelTransportModes: [],
  finishedFuelTransportModes: [],
  fuelCodeStatus: { status: 'Draft' },
  status: 'Draft',
  canEditCi: true,
  isNotesRequired: false,
  lastUpdated: '2026-08-20T12:00:00Z'
}

const secondFuelCode = {
  ...existingFuelCode,
  fuelCodeId: 902,
  fuelSuffix: '103.1',
  company: 'Pacific Renewable Fuels',
  edrms: 'EDRMS-902'
}

const analystUser = {
  userId: 1,
  username: 'cypress-analyst',
  firstName: 'Cypress',
  lastName: 'Analyst',
  organization: { organizationId: 1, name: 'Government of BC' },
  roles: [{ name: 'Government' }, { name: 'Analyst' }]
}

const pagination = (fuelCodes) => ({
  fuelCodes,
  pagination: {
    page: 1,
    size: 10,
    total: fuelCodes.length,
    totalPages: 1
  }
})

const interceptFuelCodeOptions = () => {
  cy.intercept('GET', '**/fuel-codes/table-options', fuelCodeOptions).as(
    'fuelCodeOptions'
  )
  cy.intercept('GET', '**/fuel-codes/search?*', { fuelCodes: [] }).as(
    'fuelCodeSearch'
  )
}

const interceptFuelCodeList = () => {
  cy.intercept('POST', '**/fuel-codes/list', (req) => {
    const companyFilter = req.body.filters?.find(
      ({ field }) => field === 'company'
    )
    const fuelCodes = companyFilter
      ? [existingFuelCode].filter(({ company }) =>
          company
            .toLowerCase()
            .includes(String(companyFilter.filter).toLowerCase())
        )
      : [existingFuelCode, secondFuelCode]

    req.reply(pagination(fuelCodes))
  }).as('fuelCodeList')
}

const interceptFuelCodeExport = () => {
  cy.intercept('POST', '**/fuel-codes/export?*', {
    statusCode: 200,
    headers: {
      'content-type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': 'attachment; filename="fuel-codes.xlsx"'
    },
    body: 'cypress-xlsx'
  }).as('fuelCodeExport')
}

const setGridTextCell = (field, value) => {
  cy.inputTextWithRetry(`.ag-cell[col-id="${field}"]`, value, 0)
}

describe('Fuel Code management', () => {
  const creds = idirCreds()

  before(() => {
    expect(creds.username, 'IDIR username is configured').to.be.a('string').and
      .not.be.empty
    expect(creds.password, 'IDIR password is configured').to.be.a('string').and
      .not.be.empty

    cy.loginWith('idir', creds.username, creds.password)
    cy.get('.main-layout-navbar', { timeout: 30000 }).should('be.visible')
  })

  beforeEach(() => {
    cy.intercept('GET', '**/users/current', analystUser).as('currentUser')
  })

  after(() => {
    cy.logout()
  })

  it('loads the Fuel Codes list with its data grid', () => {
    interceptFuelCodeList()

    cy.visit('/fuel-codes')
    cy.wait('@fuelCodeList')

    cy.getByDataTest('title').should('contain', 'Fuel codes')
    cy.getByDataTest('bc-grid-container').should('be.visible')
    cy.contains('Cypress Biofuels').should('be.visible')
    cy.contains('Pacific Renewable Fuels').should('be.visible')
    cy.getByDataTest('new-fuel-code-btn').should('be.visible')
  })

  it('searches by company and sends the active filter to the API', () => {
    interceptFuelCodeList()

    cy.visit('/fuel-codes')
    cy.wait('@fuelCodeList')

    cy.get('[col-id="company"]')
      .find('.ag-floating-filter-input input')
      .type('Cypress Biofuels')

    cy.wait('@fuelCodeList').then(({ request }) => {
      expect(request.body.filters).to.deep.include({
        field: 'company',
        filterType: 'text',
        type: 'contains',
        filter: 'Cypress Biofuels'
      })
    })

    cy.contains('Cypress Biofuels').should('be.visible')
    cy.contains('Pacific Renewable Fuels').should('not.exist')
  })

  it('exports Fuel Codes with the current filters and sorting', () => {
    interceptFuelCodeList()
    interceptFuelCodeExport()

    cy.visit('/fuel-codes')
    cy.wait('@fuelCodeList')

    cy.getByDataTest('fuel-code-download-btn').click()

    cy.wait('@fuelCodeExport').then(({ request }) => {
      expect(request.body).to.include({
        page: 1,
        size: 10000
      })
      expect(request.body.filters).to.deep.equal([])
      expect(request.body.sortOrders).to.deep.equal([
        { field: 'lastUpdated', direction: 'desc' }
      ])
    })
  })

  it('validates a new Fuel Code row and saves valid data', () => {
    interceptFuelCodeOptions()
    interceptFuelCodeList()

    cy.intercept('POST', '**/fuel-codes', (req) => {
      if (req.body.fuelSuffix === 'bad') {
        req.reply({
          statusCode: 422,
          body: {
            detail: [
              {
                loc: ['body', 'fuelSuffix'],
                msg: "format is invalid. Must be like '102.5'.",
                type: 'value_error'
              },
              {
                loc: ['body', 'carbonIntensity'],
                msg: 'Field required',
                type: 'missing'
              }
            ]
          }
        })
        return
      }

      req.reply({
        ...existingFuelCode,
        ...req.body,
        fuelCodeId: 901,
        fuelSuffix: '102.5'
      })
    }).as('saveFuelCodeRow')

    cy.visit('/fuel-codes/add-fuel-code')
    cy.wait('@fuelCodeOptions')

    cy.getByDataTest('fuel-code-form-title').should(
      'contain',
      'Add new fuel code'
    )
    cy.get('.ag-header-cell[col-id="fuelSuffix"]').should(
      'contain',
      'Fuel code'
    )
    cy.get('.ag-header-cell[col-id="carbonIntensity"]').should(
      'contain',
      'Carbon intensity'
    )

    setGridTextCell('fuelSuffix', 'bad')
    cy.wait('@saveFuelCodeRow')
    cy.contains("format is invalid. Must be like '102.5'.").should('be.visible')
    cy.contains('carbonIntensity: Field required').should('be.visible')
    cy.get('[data-testid="validation-sign"]').should('be.visible')

    setGridTextCell('fuelSuffix', '102.5')
    cy.wait('@saveFuelCodeRow').then(({ request }) => {
      expect(request.body).to.include({
        prefixId: 1,
        prefix: 'BCLCF',
        fuelSuffix: '102.5'
      })
    })

    cy.contains('Row updated successfully.').should('be.visible')
    cy.getByDataTest('save-fuel-code-btn').should('be.enabled').click()
    cy.location('pathname').should('eq', '/fuel-codes')
    cy.getByDataTest('alert-box').should(
      'contain',
      'Fuel code saved successfully'
    )
  })

  it('edits an existing draft Fuel Code', () => {
    interceptFuelCodeOptions()
    interceptFuelCodeList()
    cy.intercept('GET', '**/fuel-codes/901', existingFuelCode).as('getFuelCode')
    cy.intercept('POST', '**/fuel-codes', (req) => {
      req.reply({
        ...existingFuelCode,
        ...req.body,
        fuelCodeId: 901,
        fuelSuffix: '102.5'
      })
    }).as('updateFuelCodeRow')

    cy.visit('/fuel-codes/901')
    cy.wait(['@fuelCodeOptions', '@getFuelCode'])

    cy.getByDataTest('fuel-code-form-title').should('contain', 'View fuel code')
    cy.getByDataTest('edit-fuel-code-btn').click()
    cy.getByDataTest('fuel-code-form-title').should(
      'contain',
      'Edit draft fuel code'
    )

    setGridTextCell('edrms', 'EDRMS-901-UPDATED')
    cy.wait('@updateFuelCodeRow').then(({ request }) => {
      expect(request.body).to.include({
        fuelCodeId: 901,
        edrms: 'EDRMS-901-UPDATED'
      })
    })

    cy.getByDataTest('save-fuel-code-btn').click()
    cy.location('pathname').should('eq', '/fuel-codes')
    cy.getByDataTest('alert-box').should(
      'contain',
      'Fuel code saved successfully'
    )
  })

  it('renders current and archived Fuel Code bulletins', () => {
    cy.intercept(
      'POST',
      '**/fuel-codes/bulletins?bulletinType=current',
      pagination([
        {
          fuelCodeId: 901,
          fuelCode: 'BCLCF102.5',
          fuel: 'Ethanol',
          company: 'Cypress Biofuels',
          carbonIntensity: 42.15,
          effectiveDate: '2025-03-01',
          expiryDate: '2028-03-01'
        }
      ])
    ).as('currentBulletin')
    cy.intercept(
      'POST',
      '**/fuel-codes/bulletins?bulletinType=archived',
      pagination([
        {
          fuelCodeId: 800,
          fuelCode: 'BCLCF099.9',
          fuel: 'Ethanol',
          company: 'Archived Cypress Fuels',
          carbonIntensity: 55.2,
          effectiveDate: '2020-01-01',
          expiryDate: '2023-01-01'
        }
      ])
    ).as('archivedBulletin')

    cy.visit('/fuel-codes-bulletins')
    cy.wait('@currentBulletin')
    cy.getByDataTest('current-fuel-codes-title').should(
      'contain',
      'Current fuel codes'
    )
    cy.contains('BCLCF102.5').should('be.visible')
    cy.getByDataTest('current-fuel-codes-download-btn').should('be.visible')

    cy.visit('/fuel-codes-bulletins?type=archived')
    cy.wait('@archivedBulletin')
    cy.getByDataTest('archived-fuel-codes-title').should('contain', 'Archived')
    cy.contains('BCLCF099.9').should('be.visible')
    cy.getByDataTest('archived-fuel-codes-download-btn').should('be.visible')
  })
})
