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

const interceptCurrentUser = (type = 'supplier') => {
  const body =
    type === 'idir'
      ? {
          userId: 1,
          organization: { organizationId: 1, name: 'Government of BC' },
          roles: [{ name: 'Government' }, { name: 'Analyst' }]
        }
      : {
          userId: 1001,
          organization: { organizationId: 1001, name: 'LCFS Org 1' },
          roles: [{ name: 'Supplier' }, { name: 'Compliance Reporting' }]
        }

  cy.intercept('GET', '**/users/current', body).as('currentUser')
}

const interceptChargingEquipmentMetadata = () => {
  cy.intercept('GET', '**/charging-equipment/statuses/list', []).as(
    'ceStatuses'
  )
  cy.intercept('GET', '**/charging-equipment/levels/list', [
    { levelOfEquipmentId: 1, name: 'Level 2' },
    { levelOfEquipmentId: 2, name: 'Level 3' }
  ]).as('ceLevels')
  cy.intercept('GET', '**/charging-equipment/end-use-types/list', [
    { endUseTypeId: 1, type: 'Public charging' }
  ]).as('ceEndUseTypes')
  cy.intercept('GET', '**/charging-equipment/end-user-types/list', [
    { endUserTypeId: 1, type: 'Public' }
  ]).as('ceEndUserTypes')
  cy.intercept('GET', '**/charging-equipment/charging-sites/list', [
    {
      chargingSiteId: 101,
      siteName: 'Cypress Charging Site',
      latitude: 48.4284,
      longitude: -123.3656
    }
  ]).as('ceSites')
  cy.intercept('GET', '**/charging-equipment/organizations/list', [
    { organizationId: 1001, name: 'LCFS Org 1' }
  ]).as('ceOrganizations')
  cy.intercept(
    'GET',
    '**/charging-equipment/organizations/has-allocation-agreements',
    false
  ).as('ceAllocations')
}

const waitChargingEquipmentMetadata = () => {
  cy.wait([
    '@ceStatuses',
    '@ceLevels',
    '@ceEndUseTypes',
    '@ceEndUserTypes',
    '@ceSites',
    '@ceOrganizations',
    '@ceAllocations'
  ])
}

const setAgTextCell = (colId, value, rowIndex = 0) => {
  cy.inputTextWithRetry(`.ag-cell[col-id="${colId}"]`, value, rowIndex)
}

describe('ChargingEquipment create/edit/list filters/download', () => {
  const supplier = supplierCreds()
  const idir = idirCreds()

  before(() => {
    expect(supplier.username, 'BCeID username').to.be.a('string').and.not.be
      .empty
    expect(supplier.password, 'BCeID password').to.be.a('string').and.not.be
      .empty
    expect(idir.username, 'IDIR username').to.be.a('string').and.not.be.empty
    expect(idir.password, 'IDIR password').to.be.a('string').and.not.be.empty
  })

  it('creates and edits charging equipment (supplier)', () => {
    cy.loginWith('bceid', supplier.username, supplier.password)
    cy.get('.main-layout-navbar', { timeout: 30000 }).should('be.visible')

    interceptCurrentUser('supplier')
    interceptChargingEquipmentMetadata()

    cy.intercept('POST', '**/charging-equipment/', (req) => {
      req.reply({
        id: req.body.id,
        chargingEquipmentId: 7001,
        chargingSiteId: 101,
        status: 'Draft',
        registrationNumber: 'REG-7001',
        serialNumber: req.body.serialNumber || 'SER-NEW-7001',
        manufacturer: 'ACME',
        model: 'Created Model',
        levelOfEquipmentId: 1,
        ports: 'Single port',
        intendedUseIds: [1],
        intendedUserIds: [1],
        latitude: 48.4284,
        longitude: -123.3656
      })
    }).as('createEquipment')

    cy.visit('/compliance-reporting/fse/add', { timeout: 30000 })
    waitChargingEquipmentMetadata()

    setAgTextCell('serialNumber', 'SER-NEW-7001')
    cy.wait('@createEquipment')
    cy.getByDataTest('save-btn', { timeout: 30000 }).click()

    interceptCurrentUser('supplier')
    interceptChargingEquipmentMetadata()
    cy.intercept('GET', '**/charging-equipment/7001', {
      chargingEquipmentId: 7001,
      chargingSiteId: 101,
      status: 'Draft',
      registrationNumber: 'REG-7001',
      serialNumber: 'SER-NEW-7001',
      manufacturer: 'ACME',
      model: 'Created Model',
      levelOfEquipmentId: 1,
      ports: 'Single port',
      intendedUseIds: [1],
      intendedUserIds: [1],
      latitude: 48.4284,
      longitude: -123.3656
    }).as('getEquipment')
    cy.intercept('PUT', '**/charging-equipment/7001', (req) => {
      req.reply({
        ...req.body,
        chargingEquipmentId: 7001,
        status: 'Draft',
        registrationNumber: 'REG-7001'
      })
    }).as('updateEquipment')

    cy.visit('/compliance-reporting/fse/7001/edit', { timeout: 30000 })
    cy.wait('@getEquipment')
    waitChargingEquipmentMetadata()

    setAgTextCell('serialNumber', 'SER-EDIT-7001')
    cy.wait('@updateEquipment')
    cy.getByDataTest('save-btn', { timeout: 30000 }).click()

    cy.logout()
  })

  it('applies list filter and downloads charging equipment export (IDIR)', () => {
    cy.loginWith('idir', idir.username, idir.password)
    cy.get('.main-layout-navbar', { timeout: 30000 }).should('be.visible')

    interceptCurrentUser('idir')

    cy.intercept('GET', '**/organizations/names/all*', [
      { organizationId: 1001, name: 'LCFS Org 1', orgType: 'supplier' },
      { organizationId: 1002, name: 'LCFS Org 2', orgType: 'supplier' }
    ]).as('orgNames')

    cy.intercept('POST', '**/charging-equipment/list', (req) => {
      const orgId = req.body?.organization_id || null
      if (orgId) {
        req.alias = 'equipmentListFiltered'
      } else {
        req.alias = 'equipmentList'
      }

      req.reply({
        items: [
          {
            chargingEquipmentId: 7101,
            chargingSiteId: 101,
            siteName: 'Cypress Charging Site',
            organizationName: orgId === 1002 ? 'LCFS Org 2' : 'LCFS Org 1',
            status: 'Draft',
            registrationNumber: 'REG-7101',
            serial_number: 'SER-7101',
            manufacturer: 'ACME',
            model: 'Filter Unit'
          }
        ],
        pagination: { page: 1, size: 25, total: 1, totalPages: 1 }
      })
    })

    cy.intercept('POST', '**/charging-equipment/export', {
      statusCode: 200,
      body: 'fake-xlsx-content',
      headers: {
        'content-type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    }).as('downloadEquipmentExport')

    cy.visit('/compliance-reporting/fse', { timeout: 30000 })
    cy.wait(['@orgNames', '@equipmentList'])

    cy.contains('.filter-toolbar', 'Show FSE for:', { timeout: 30000 })
      .should('be.visible')
      .find('input')
      .first()
      .should('be.visible')
      .type('LCFS Org 2')
    cy.contains('li', 'LCFS Org 2', { timeout: 30000 }).should('be.visible').click()
    cy.wait('@equipmentListFiltered').its('request.body.organization_id').should('eq', 1002)

    cy.getByDataTest('download-fse-excel', { timeout: 30000 }).click()
    cy.wait('@downloadEquipmentExport')

    cy.contains('button', 'Clear filters', { timeout: 30000 }).click()
    cy.wait('@equipmentList')

    cy.logout()
  })
})

describe('FSE Reporting grid interactions + save flow', () => {
  const supplier = supplierCreds()

  before(() => {
    expect(supplier.username, 'BCeID username').to.be.a('string').and.not.be
      .empty
    expect(supplier.password, 'BCeID password').to.be.a('string').and.not.be
      .empty
  })

  it('supports selecting FSE rows, setting defaults, editing values, and save changes', () => {
    cy.loginWith('bceid', supplier.username, supplier.password)
    cy.get('.main-layout-navbar', { timeout: 30000 }).should('be.visible')

    interceptCurrentUser('supplier')

    const reportId = 123
    const reportPath = `/compliance-reporting/2025/${reportId}/fse-reporting`
    const groupUuid = 'test-group-uuid'
    let reportingRows = [
      {
        chargingEquipmentId: 8001,
        chargingEquipmentVersion: 1,
        chargingEquipmentComplianceId: null,
        complianceReportId: null,
        complianceReportGroupUuid: groupUuid,
        isActive: true,
        supplyFromDate: null,
        supplyToDate: null,
        kwhUsage: null,
        complianceNotes: null,
        siteName: 'Cypress Charging Site',
        registrationNumber: 'REG-8001',
        serialNumber: 'SER-8001',
        manufacturer: 'ACME'
      }
    ]

    cy.intercept('GET', '**/organization/1001/reports/123', {
      report: {
        complianceReportId: reportId,
        organizationId: 1001,
        complianceReportGroupUuid: groupUuid
      }
    }).as('getComplianceReport')
    cy.intercept('GET', '**/reports/123', {
      report: {
        complianceReportId: reportId,
        organizationId: 1001,
        complianceReportGroupUuid: groupUuid
      }
    }).as('getComplianceReport')

    cy.intercept('GET', '**/charging-sites/names*', [
      { chargingSiteId: 101, siteName: 'Cypress Charging Site' },
      { chargingSiteId: 102, siteName: 'Other Site' }
    ]).as('siteNames')

    cy.intercept(
      'POST',
      '**/final-supply-equipments/reporting/list?*complianceReportId=123*',
      (req) => {
        if (
          Array.isArray(req.body?.filters) &&
          req.body.filters.some(
            (f) => f.field === 'chargingSiteId' && f.filter === 101
          )
        ) {
          req.alias = 'fseReportingListFiltered'
        } else {
          req.alias = 'fseReportingList'
        }

        req.reply({
          finalSupplyEquipments: reportingRows,
          pagination: { page: 1, size: 10, total: reportingRows.length },
          hasChargingEquipment: true
        })
      }
    )

    cy.intercept('POST', '**/final-supply-equipments/reporting/batch', (req) => {
      req.reply([
        {
          chargingEquipmentComplianceId: 9001
        }
      ])
    }).as('createFseReportingRows')

    cy.intercept(
      'POST',
      '**/final-supply-equipments/reporting/set-default',
      { message: 'Defaults updated' }
    ).as('setFseDefaults')

    cy.intercept('PUT', '**/final-supply-equipments/reporting/9001', (req) => {
      reportingRows = reportingRows.map((row) =>
        row.chargingEquipmentId === 8001
          ? {
              ...row,
              chargingEquipmentComplianceId: 9001,
              kwhUsage: req.body.kwhUsage,
              complianceNotes: req.body.complianceNotes,
              supplyFromDate: req.body.supplyFromDate,
              supplyToDate: req.body.supplyToDate
            }
          : row
      )
      req.reply({
        ...req.body,
        chargingEquipmentComplianceId: 9001,
        validationStatus: 'success',
        modified: true
      })
    }).as('updateFseReportingRow')

    cy.intercept('PATCH', '**/final-supply-equipments/reporting/active-status', {
      message: 'Updated active status'
    }).as('toggleFseReportingActive')

    cy.visit(reportPath, { timeout: 30000 })
    cy.wait(['@siteNames', '@fseReportingList'])

    cy.contains('h5', 'FSE compliance reporting', { timeout: 30000 }).should(
      'be.visible'
    )

    cy.get('#site-selector input', { timeout: 30000 })
      .should('be.visible')
      .type('Cypress Charging Site')
    cy.contains('li', 'Cypress Charging Site', { timeout: 30000 })
      .should('be.visible')
      .click()
    cy.wait('@fseReportingListFiltered')

    cy.contains('.ag-row', 'REG-8001', { timeout: 30000 })
      .find('.ag-selection-checkbox input[type="checkbox"]')
      .check({ force: true })
    cy.wait('@createFseReportingRows')

    cy.contains('button', 'Set default values', { timeout: 30000 }).click()
    cy.wait('@setFseDefaults')

    setAgTextCell('kwhUsage', '1500')
    cy.wait('@updateFseReportingRow')

    cy.getByDataTest('save-btn', { timeout: 30000 }).click()
    cy.location('pathname', { timeout: 30000 }).should(
      'eq',
      '/compliance-reporting/2025/123'
    )

    cy.logout()
  })
})
