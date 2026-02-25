/* eslint-disable cypress/unsafe-to-chain-command */

const supplierCreds = () => ({
  username:
    Cypress.env('ORG1_BCEID_USERNAME') ||
    Cypress.env('BCEID_TEST_USER') ||
    Cypress.env('ORG2_BCEID_USERNAME'),
  password:
    Cypress.env('ORG1_BCEID_PASSWORD') ||
    Cypress.env('BCEID_TEST_PASS') ||
    Cypress.env('ORG2_BCEID_PASSWORD')
})

const idirCreds = () => ({
  username: Cypress.env('IDIR_TEST_USER') || Cypress.env('ADMIN_IDIR_USERNAME'),
  password: Cypress.env('IDIR_TEST_PASS') || Cypress.env('ADMIN_IDIR_PASSWORD')
})

const supplierSite = {
  chargingSiteId: 101,
  siteName: 'Cypress Charging Site',
  siteCode: 'CS-101',
  streetAddress: '123 Test St',
  city: 'Victoria',
  postalCode: 'V8V 1A1',
  latitude: 48.4284,
  longitude: -123.3656,
  version: 1,
  status: { status: 'Draft' },
  notes: 'Cypress site note',
  organization: { organizationId: 1001, name: 'LCFS Org 1' },
  intendedUsers: ['Public'],
  documents: []
}

const supplierSiteEquipment = [
  {
    chargingEquipmentId: 2001,
    chargingSiteId: 101,
    status: { status: 'Draft' },
    siteName: 'Cypress Charging Site',
    registrationNumber: 'REG-2001',
    serialNumber: 'SER-2001',
    manufacturer: 'ACME',
    model: 'FastOne',
    levelOfEquipmentName: 'Level 2',
    ports: 'Single port',
    latitude: 48.4284,
    longitude: -123.3656,
    intendedUseIds: [1],
    intendedUserIds: [1]
  },
  {
    chargingEquipmentId: 2002,
    chargingSiteId: 101,
    status: { status: 'Validated' },
    siteName: 'Cypress Charging Site',
    registrationNumber: 'REG-2002',
    serialNumber: 'SER-2002',
    manufacturer: 'ACME',
    model: 'FastTwo',
    levelOfEquipmentName: 'Level 3',
    ports: 'Dual port',
    latitude: 48.4284,
    longitude: -123.3656,
    intendedUseIds: [1],
    intendedUserIds: [1]
  }
]

const interceptCurrentUser = ({ type = 'supplier' } = {}) => {
  const user =
    type === 'idir'
      ? {
          userId: 1,
          username: 'idir-user',
          firstName: 'IDIR',
          lastName: 'Tester',
          organization: { organizationId: 1, name: 'Government of BC' },
          roles: [{ name: 'Government' }, { name: 'Analyst' }]
        }
      : {
          userId: 1001,
          username: 'bceid-user',
          firstName: 'Supplier',
          lastName: 'Tester',
          organization: { organizationId: 1001, name: 'LCFS Org 1' },
          roles: [{ name: 'Supplier' }, { name: 'Compliance Reporting' }]
        }

  cy.intercept('GET', '**/users/current', user).as('currentUser')
}

const interceptSharedChargingSiteOptions = () => {
  cy.intercept('GET', '**/charging-sites/statuses', [
    { status: 'Draft' },
    { status: 'Submitted' },
    { status: 'Validated' },
    { status: 'Decommissioned' }
  ])
  cy.intercept('GET', '**/charging-sites/equipment/statuses', [
    { status: 'Draft' },
    { status: 'Updated' },
    { status: 'Submitted' },
    { status: 'Validated' },
    { status: 'Decommissioned' }
  ])
}

const interceptSupplierChargingSiteList = (sites = [supplierSite]) => {
  cy.intercept('POST', '**/charging-sites/organization/*/list-all', (req) => {
    req.reply({
      chargingSites: sites,
      pagination: {
        page: 1,
        size: 10,
        total: sites.length,
        totalPages: 1
      }
    })
  }).as('supplierChargingSitesList')
}

const interceptViewChargingSite = ({
  site = supplierSite,
  equipment = supplierSiteEquipment
} = {}) => {
  interceptSharedChargingSiteOptions()

  cy.intercept('GET', `**/charging-sites/${site.chargingSiteId}`, site).as(
    'getChargingSite'
  )

  cy.intercept(
    'POST',
    `**/charging-sites/${site.chargingSiteId}/equipment/list-all`,
    {
      statusCode: 200,
      body: {
        status: site.status,
        organizationId: site.organization.organizationId,
        equipments: equipment,
        pagination: { page: 1, size: 25, total: equipment.length, totalPages: 1 }
      }
    }
  ).as('getChargingSiteEquipment')
}

const setAgTextCell = (colId, value, rowIndex = 0) => {
  cy.inputTextWithRetry(`.ag-cell[col-id="${colId}"]`, value, rowIndex)
}

describe('Charging Site and FSE supplier workflows', () => {
  const creds = supplierCreds()

  before(() => {
    expect(creds.username, 'BCeID username is configured')
      .to.be.a('string')
      .and.not.be.empty
    expect(creds.password, 'BCeID password is configured')
      .to.be.a('string')
      .and.not.be.empty

    cy.loginWith('bceid', creds.username, creds.password)
    cy.get('.main-layout-navbar', { timeout: 30000 }).should('be.visible')
  })

  after(() => {
    cy.logout()
  })

  it('views the Charging Sites list', () => {
    interceptCurrentUser({ type: 'supplier' })
    interceptSupplierChargingSiteList()
    interceptSharedChargingSiteOptions()

    cy.visit('/compliance-reporting/charging-sites', { timeout: 30000 })

    cy.contains('h5, h6', 'Manage charging sites', { timeout: 30000 }).should(
      'be.visible'
    )
    cy.wait('@supplierChargingSitesList')
    cy.contains('Cypress Charging Site').should('be.visible')
    cy.get('.leaflet-container', { timeout: 30000 }).should('exist')
  })

  it('creates a new Charging Site', () => {
    interceptCurrentUser({ type: 'supplier' })
    interceptSupplierChargingSiteList([])
    interceptSharedChargingSiteOptions()

    cy.intercept('POST', '**/charging-sites/organization/*/save', (req) => {
      req.reply({
        ...supplierSite,
        ...req.body,
        chargingSiteId: 999,
        siteName: req.body.siteName || 'Created Cypress Site',
        status: { status: 'Draft' },
        version: 1
      })
    }).as('createChargingSite')

    cy.visit('/compliance-reporting/charging-sites', { timeout: 30000 })
    cy.get('#new-site-button', { timeout: 30000 }).click()
    cy.location('pathname').should(
      'eq',
      '/compliance-reporting/charging-sites/add'
    )

    setAgTextCell('siteName', 'Created Cypress Site')
    cy.wait('@createChargingSite')

    cy.getByDataTest('save-btn', { timeout: 30000 }).click()
    cy.location('pathname', { timeout: 30000 }).should(
      'eq',
      '/compliance-reporting/charging-sites'
    )
  })

  it('edits a Charging Site', () => {
    interceptCurrentUser({ type: 'supplier' })
    interceptViewChargingSite()
    cy.intercept('PUT', '**/charging-sites/organization/*/save/101', (req) => {
      req.reply({
        ...supplierSite,
        ...req.body,
        chargingSiteId: 101,
        siteName: req.body.siteName || 'Edited Cypress Charging Site'
      })
    }).as('updateChargingSite')

    cy.visit('/compliance-reporting/charging-sites/101', { timeout: 30000 })
    cy.wait(['@getChargingSite', '@getChargingSiteEquipment'])
    cy.get('#edit-charging-site-button', { timeout: 30000 }).click()

    setAgTextCell('siteName', 'Edited Cypress Charging Site')
    cy.wait('@updateChargingSite')

    cy.getByDataTest('save-btn', { timeout: 30000 }).click()
  })

  it('views Charging Site details (ChargingSiteCard)', () => {
    interceptCurrentUser({ type: 'supplier' })
    interceptViewChargingSite()

    cy.visit('/compliance-reporting/charging-sites/101', { timeout: 30000 })
    cy.wait(['@getChargingSite', '@getChargingSiteEquipment'])

    cy.getByDataTest('view-charging-site-fse', { timeout: 30000 }).should(
      'exist'
    )
    cy.contains('h6', 'Cypress Charging Site').should('be.visible')
    cy.contains('Site address:').should('be.visible')
    cy.contains('123 Test St, Victoria, V8V 1A1').should('be.visible')
  })

  it('adds Charging Equipment to a site', () => {
    interceptCurrentUser({ type: 'supplier' })
    interceptViewChargingSite({ equipment: [] })

    cy.intercept('GET', '**/charging-equipment/statuses/list', []).as(
      'fseStatuses'
    )
    cy.intercept('GET', '**/charging-equipment/levels/list', [
      { levelOfEquipmentId: 1, name: 'Level 2' }
    ]).as('fseLevels')
    cy.intercept('GET', '**/charging-equipment/end-use-types/list', [
      { endUseTypeId: 1, type: 'Public charging' }
    ]).as('fseEndUses')
    cy.intercept('GET', '**/charging-equipment/end-user-types/list', [
      { endUserTypeId: 1, type: 'Public' }
    ]).as('fseEndUsers')
    cy.intercept('GET', '**/charging-equipment/charging-sites/list', [
      {
        chargingSiteId: 101,
        siteName: 'Cypress Charging Site',
        latitude: 48.4284,
        longitude: -123.3656
      }
    ]).as('fseSites')
    cy.intercept('GET', '**/charging-equipment/organizations/list', [
      { organizationId: 1001, name: 'LCFS Org 1' }
    ]).as('fseOrgs')
    cy.intercept(
      'GET',
      '**/charging-equipment/organizations/has-allocation-agreements',
      false
    ).as('hasAllocations')

    cy.intercept('POST', '**/charging-equipment/', (req) => {
      req.reply({
        id: req.body.id,
        chargingEquipmentId: 3001,
        chargingSiteId: 101,
        status: 'Draft',
        serialNumber: req.body.serialNumber || 'CY-SERIAL-1',
        manufacturer: 'ACME',
        model: 'FastOne',
        levelOfEquipmentId: 1,
        ports: 'Single port',
        intendedUseIds: [1],
        intendedUserIds: [1],
        latitude: 48.4284,
        longitude: -123.3656
      })
    }).as('createChargingEquipment')

    cy.visit('/compliance-reporting/charging-sites/101', { timeout: 30000 })
    cy.wait(['@getChargingSite', '@getChargingSiteEquipment'])

    cy.contains('button', 'New FSE', { timeout: 30000 }).click()
    cy.location('pathname', { timeout: 30000 }).should(
      'eq',
      '/compliance-reporting/fse/add'
    )

    cy.wait([
      '@fseStatuses',
      '@fseLevels',
      '@fseEndUses',
      '@fseEndUsers',
      '@fseSites',
      '@fseOrgs',
      '@hasAllocations'
    ])

    setAgTextCell('serialNumber', 'CY-SERIAL-1')
    cy.wait('@createChargingEquipment')

    cy.getByDataTest('save-btn', { timeout: 30000 }).click()
  })

  it('performs bulk FSE operations (submit and decommission)', () => {
    interceptCurrentUser({ type: 'supplier' })
    let equipmentRows = [
      {
        chargingEquipmentId: 4001,
        chargingSiteId: 101,
        siteName: 'Cypress Charging Site',
        status: 'Draft',
        registrationNumber: 'REG-4001',
        serial_number: 'SER-4001',
        manufacturer: 'ACME',
        model: 'DraftUnit'
      },
      {
        chargingEquipmentId: 4002,
        chargingSiteId: 101,
        siteName: 'Cypress Charging Site',
        status: 'Updated',
        registrationNumber: 'REG-4002',
        serial_number: 'SER-4002',
        manufacturer: 'ACME',
        model: 'UpdatedUnit'
      },
      {
        chargingEquipmentId: 4003,
        chargingSiteId: 101,
        siteName: 'Cypress Charging Site',
        status: 'Validated',
        registrationNumber: 'REG-4003',
        serial_number: 'SER-4003',
        manufacturer: 'ACME',
        model: 'ValidatedUnit'
      }
    ]

    cy.intercept('POST', '**/charging-equipment/list', (req) => {
      req.reply({
        items: equipmentRows,
        pagination: { page: 1, size: 25, total: equipmentRows.length, totalPages: 1 }
      })
    }).as('chargingEquipmentList')

    cy.intercept('POST', '**/charging-equipment/bulk/submit', (req) => {
      const ids = req.body?.charging_equipment_ids || []
      equipmentRows = equipmentRows.map((row) =>
        ids.includes(row.chargingEquipmentId) &&
        ['Draft', 'Updated'].includes(row.status)
          ? { ...row, status: 'Submitted' }
          : row
      )
      req.reply({ message: 'Equipment submitted successfully.' })
    }).as('bulkSubmit')

    cy.intercept('POST', '**/charging-equipment/bulk/decommission', (req) => {
      const ids = req.body?.charging_equipment_ids || []
      equipmentRows = equipmentRows.map((row) =>
        ids.includes(row.chargingEquipmentId) && row.status === 'Validated'
          ? { ...row, status: 'Decommissioned' }
          : row
      )
      req.reply({ message: 'Equipment decommissioned successfully.' })
    }).as('bulkDecommission')

    cy.visit('/compliance-reporting/fse', { timeout: 30000 })
    cy.wait('@chargingEquipmentList')

    cy.contains('button', 'Select all Draft/Updated', { timeout: 30000 }).click()
    cy.contains('button', 'Submit selected').click()
    cy.contains('button', 'Submit selected', { timeout: 30000 }).last().click()
    cy.wait('@bulkSubmit')
    cy.getByDataTest('alert-box').should('contain', 'submitted')

    cy.contains('button', 'Select all Validated', { timeout: 30000 }).click()
    cy.contains('button', 'Set to Decommissioned').first().click()
    cy.contains('button', 'Set to Decommissioned', { timeout: 30000 })
      .last()
      .click()
    cy.wait('@bulkDecommission')
    cy.getByDataTest('alert-box').should('contain', 'decommissioned')
  })
})

describe('FSE processing and map workflows (IDIR)', () => {
  const creds = idirCreds()

  before(() => {
    expect(creds.username, 'IDIR username is configured')
      .to.be.a('string')
      .and.not.be.empty
    expect(creds.password, 'IDIR password is configured')
      .to.be.a('string')
      .and.not.be.empty

    cy.loginWith('idir', creds.username, creds.password)
    cy.get('.main-layout-navbar', { timeout: 30000 }).should('be.visible')
  })

  after(() => {
    cy.logout()
  })

  it('completes an FSE Processing workflow (validate submitted)', () => {
    interceptCurrentUser({ type: 'idir' })
    let processingEquipment = [
      {
        charging_equipment_id: 5001,
        registration_number: 'REG-5001',
        version: 1,
        allocating_organization_name: 'LCFS Org 1',
        serial_number: 'SER-5001',
        manufacturer: 'ACME',
        model: 'ProcUnit',
        level_of_equipment_name: 'Level 2',
        status: 'Submitted'
      },
      {
        charging_equipment_id: 5002,
        registration_number: 'REG-5002',
        version: 1,
        allocating_organization_name: 'LCFS Org 1',
        serial_number: 'SER-5002',
        manufacturer: 'ACME',
        model: 'ProcUnit2',
        level_of_equipment_name: 'Level 3',
        status: 'Validated'
      }
    ]

    cy.intercept(
      'GET',
      '**/charging-equipment/charging-sites/101/equipment-processing',
      (req) => {
        req.reply({
          site: {
            site_name: 'Processing Site',
            status: 'Submitted',
            version: 1,
            site_code: 'CS-PROC-101',
            organization: 'LCFS Org 1',
            site_address: '456 Process Ave',
            city: 'Vancouver',
            postal_code: 'V6B 1A1',
            intended_uses: [{ type: 'Public' }],
            site_notes: 'Processing test site'
          },
          equipment: {
            items: processingEquipment,
            total_count: processingEquipment.length
          }
        })
      }
    ).as('getFseProcessing')

    cy.intercept('POST', '**/charging-equipment/bulk/validate', (req) => {
      const ids = req.body?.charging_equipment_ids || []
      processingEquipment = processingEquipment.map((row) =>
        ids.includes(row.charging_equipment_id)
          ? { ...row, status: 'Validated' }
          : row
      )
      req.reply({ message: 'Validated equipment successfully.' })
    }).as('bulkValidate')

    cy.visit('/charging-sites/101/equipment-processing', { timeout: 30000 })
    cy.wait('@getFseProcessing')

    cy.contains('h5, h6', 'Charging site/FSE processing', {
      timeout: 30000
    }).should('be.visible')
    cy.contains('button', 'Select all submitted').click()
    cy.contains('button', 'Set selected as validated').click()
    cy.contains('button', 'Validate Equipment', { timeout: 30000 })
      .last()
      .click()
    cy.wait('@bulkValidate')
    cy.getByDataTest('alert-box').should('contain', 'Validated')
  })

  it('renders the FSE map view and supports interactions', () => {
    interceptCurrentUser({ type: 'idir' })
    cy.intercept('GET', '**/organizations/names/all*', [
        { organizationId: 1001, name: 'LCFS Org 1', orgType: 'supplier' },
        { organizationId: 1002, name: 'LCFS Org 2', orgType: 'supplier' }
    ]).as('orgNames')

    cy.intercept('POST', '**/charging-equipment/list', {
      items: [
        {
          charging_equipment_id: 6001,
          charging_site_id: 101,
          registration_number: 'REG-6001',
          organization_name: 'LCFS Org 1',
          site_name: 'Map Site 1',
          latitude: 49.2827,
          longitude: -123.1207,
          site_latitude: 49.2827,
          site_longitude: -123.1207,
          level_of_equipment_name: 'Level 2',
          serial_number: 'MAP-1',
          manufacturer: 'ACME',
          model: 'MapUnit',
          status: 'Validated'
        }
      ],
      pagination: { total: 1 }
    }).as('fseMapEquipment')

    const mapSitesBody = {
      chargingSites: [
        {
          chargingSiteId: 101,
          siteName: 'Map Site 1',
          latitude: 49.2827,
          longitude: -123.1207,
          status: { status: 'Validated' },
          streetAddress: '123 Map St',
          city: 'Vancouver',
          postalCode: 'V6B 1A1'
        }
      ],
      pagination: { total: 1 }
    }

    cy.intercept('POST', '**/charging-sites/list-all', mapSitesBody).as('fseMapSites')
    cy.intercept(
      'POST',
      '**/charging-sites/organization/*/list-all',
      mapSitesBody
    ).as('fseMapSites')

    cy.visit('/compliance-reporting/fse-map', { timeout: 30000 })
    cy.wait('@fseMapEquipment')
    cy.wait('@fseMapSites')

    cy.get('.leaflet-container', { timeout: 30000 }).should('be.visible')
    cy.contains('button', 'FSE coordinates', { timeout: 30000 }).click()
    cy.contains('button', 'Charging sites').should('be.visible')

    cy.get('[aria-label="Expand map"]', { timeout: 30000 }).click({ force: true })
    cy.get('[aria-label="Collapse map"]', { timeout: 30000 }).should('exist')
    cy.get('[aria-label="Collapse map"]').click({ force: true })
    cy.get('[aria-label="Expand map"]').should('exist')
  })
})
