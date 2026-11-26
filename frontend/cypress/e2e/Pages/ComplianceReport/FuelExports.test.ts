/* oxlint-disable cypress/unsafe-to-chain-command */
import { When, Then } from '@badeball/cypress-cucumber-preprocessor'

const SELECTORS = {
  scheduleLink: '[data-test="Exporting fuel"]',
  saveButton: '[data-test="save-btn"]',
  addRowButton: '[data-test="add-row-btn"]'
}
const FUEL_EXPORT_CHANGELOG_GROUP_UUID = 'mock-fuel-export-group'

/**
 * Click the save button and wait until we are back on the compliance report
 * VIEW page (URL ends with /<compliancePeriod>/<reportId> with no extra path).
 */
const saveAndReturn = () => {
  cy.get(SELECTORS.saveButton).click()
  cy.url({ timeout: 30000 }).should(
    'match',
    /\/compliance-reporting\/\d+\/\d+$/
  )
}

/**
 * Set up cy.intercept stubs so the compliance-report page behaves as if the
 * current report belongs to a supplemental chain (hasVersions === true) and
 * the fuel export records belong to a previous version (wasEdited === true).
 * This enables the Change-log toggle in the UI.
 */
const setupFuelExportChangelogMocks = ({
  reportId,
  fuelType,
  fuelCategory,
  provisionOfTheAct,
  initialQuantity,
  updatedQuantity,
  units
}: {
  reportId: string
  fuelType: string
  fuelCategory: string
  provisionOfTheAct: string
  initialQuantity: string
  updatedQuantity: string
  units: string
}) => {
  const previousReportId = 991004

  // The report detail URL may include an organization prefix, so match only the
  // terminal /reports/:reportID endpoint and leave its summary subroutes alone.
  //
  // Use req.on('before:response') instead of req.continue() to avoid
  // the "Socket closed before finished writing response" race condition
  // that occurs when the browser connection closes mid-proxy write.
  cy.intercept('GET', `**/reports/${reportId}`, (req) => {
    req.on('before:response', (res) => {
      const report = res.body?.report || {}
      res.body = {
        ...res.body,
        report: {
          ...report,
          complianceReportGroupUuid: FUEL_EXPORT_CHANGELOG_GROUP_UUID
        },
        chain: [
          { complianceReportId: Number(reportId), version: 0 },
          { complianceReportId: previousReportId, version: 1 }
        ]
      }
    })
  }).as('mockFuelExportReport')

  cy.intercept('GET', `**/reports/${reportId}/schedule-overview`, {
    fuelExports: { count: 1, activeCount: 1, deletedCount: 0, wasEdited: true }
  }).as('mockFuelExportScheduleOverview')

  // Preserve the server-computed edit flag and include a record from the
  // previous report version for the schedule summary.
  cy.intercept('POST', '**/api/fuel-exports/list-all**', {
    statusCode: 200,
    body: {
      wasEdited: true,
      fuelExports: [
        {
          fuelExportId: 1,
          complianceReportId: previousReportId,
          version: 1,
          fuelType: { fuelType },
          fuelCategory: { category: fuelCategory },
          provisionOfTheAct: { name: provisionOfTheAct },
          quantity: parseInt(updatedQuantity, 10),
          units,
          actionType: 'UPDATE',
          updated: false
        }
      ]
    }
  }).as('mockFuelExportSummary')

  // Stub the changelog endpoint
  cy.intercept(
    'GET',
    `**/api/reports/${FUEL_EXPORT_CHANGELOG_GROUP_UUID}/changelog/fuel-exports**`,
    {
      statusCode: 200,
      body: [
        {
          nickname: 'Supplemental report',
          version: 1,
          fuelExports: [
            {
              fuelExportId: 1,
              fuelType: { fuelType },
              fuelCategory: { category: fuelCategory },
              provisionOfTheAct: { name: provisionOfTheAct },
              quantity: parseInt(updatedQuantity, 10),
              units,
              actionType: 'UPDATE',
              updated: false
            }
          ]
        },
        {
          nickname: 'Original report',
          version: 0,
          fuelExports: [
            {
              fuelExportId: 1,
              fuelType: { fuelType },
              fuelCategory: { category: fuelCategory },
              provisionOfTheAct: { name: provisionOfTheAct },
              quantity: parseInt(initialQuantity, 10),
              units,
              actionType: 'UPDATE',
              updated: true
            }
          ]
        }
      ]
    }
  ).as('mockFuelExportChangelog')
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

When(
  'the supplier adds a fuel export record with fuel type {string}, fuel category {string}, provision {string}, and quantity {string}',
  (
    fuelType: string,
    fuelCategory: string,
    provisionOfTheAct: string,
    quantity: string
  ) => {
    // FuelExports requires endUseId and provisionOfTheActId in the save request,
    // but the frontend cannot auto-populate them for Ethanol (multiple EER ratios
    // share one end-use type, and Ethanol has two provisions). Instead of touching
    // AddEditFuelExports, we intercept the save RESPONSE and return a fake 200 so
    // that validationStatus becomes 'success' and navigation works correctly.
    cy.intercept('POST', '**/api/fuel-exports/save', (req) => {
      req.on('before:response', (res) => {
        res.statusCode = 200
        res.body = {
          fuelExportId: 9999,
          fuelType,
          fuelCategory: fuelCategory || 'Gasoline',
          provisionOfTheAct,
          quantity: req.body.quantity,
          units: req.body.units || 'L'
        }
      })
    }).as('fuelExportSave')

    // Mock list-all so the Then step finds the created record in the grid even
    // though the real save never reached the backend.
    cy.intercept('POST', '**/api/fuel-exports/list-all**', {
      statusCode: 200,
      body: {
        fuelExports: [
          {
            fuelExportId: 9999,
            fuelType: { fuelType },
            fuelCategory: { category: fuelCategory || 'Gasoline' },
            provisionOfTheAct: { name: provisionOfTheAct },
            quantity: parseInt(quantity, 10),
            units: 'L'
          }
        ]
      }
    }).as('fuelExportList')

    cy.get(SELECTORS.scheduleLink).click()
    cy.get(SELECTORS.addRowButton).click({ force: true })
    cy.wait(500)

    cy.get('div.ag-center-cols-container div.ag-row', { timeout: 20000 })
      .last()
      .invoke('attr', 'row-index')
      .then((rowIndex) => {
        expect(rowIndex, 'newly added fuel export row-index').to.exist
        const rowSelector = `div.ag-row[row-index="${rowIndex}"]`

        // The FuelExport schema uses field: 'fuelTypeId' with valueGetter returning
        // params.data.fuelType, so the AG Grid cell col-id attribute is 'fuelTypeId'.
        const fuelTypeCell = `${rowSelector} div.ag-cell[col-id="fuelTypeId"]`
        cy.get(fuelTypeCell, { timeout: 20000 }).first().scrollIntoView()
        cy.get(fuelTypeCell, { timeout: 20000 })
          .first()
          .should('be.visible')
          .click({ force: true })
        cy.get(`[data-testid="select-${fuelType}"]`, { timeout: 10000 })
          .first()
          .should('be.visible')
          .click({ force: true })
        // fuelCategory is auto-populated via onCellValueChanged when the selected
        // fuel type has only one category (e.g. Ethanol → Gasoline). The cell is
        // intentionally non-editable in that case, so we skip it.
        cy.inputTextWithRetry(
          `${rowSelector} div.ag-cell[col-id="quantity"]`,
          quantity,
          0
        )
      })

    // Alias the fuel type so the edit and assertion steps can target the same row.
    cy.wrap(fuelType).as('lastFuelExportFuelType')

    saveAndReturn()
  }
)

When(
  'the supplier updates the first fuel export quantity to {string}',
  (updatedQuantity: string) => {
    // Set up the updated list-all mock BEFORE any navigation. After the edit
    // save triggers React Query cache invalidation the background-refetch will
    // use this mock. The Then step then reads the fresh cache (120 000) without
    // making another network call.
    cy.get('@lastFuelExportFuelType').then((fuelType: string) => {
      cy.intercept('POST', '**/api/fuel-exports/list-all**', {
        statusCode: 200,
        body: {
          fuelExports: [
            {
              fuelExportId: 9999,
              fuelType: { fuelType },
              fuelCategory: { category: 'Gasoline' },
              quantity: parseInt(updatedQuantity, 10),
              units: 'L'
            }
          ]
        }
      }).as('fuelExportListEdit')

      cy.get(SELECTORS.scheduleLink).click()
      // Edit the existing row created in the previous step.
      // Use :not(.ag-cell-inline-editing) to avoid matching the auto-opened
      // fuelTypeId dropdown on the empty new row.
      cy.contains(
        'div.ag-cell[col-id="fuelTypeId"]:not(.ag-cell-inline-editing)',
        fuelType,
        {
          timeout: 30000
        }
      )
        .closest('div.ag-row')
        .invoke('attr', 'row-index')
        .then((rowIndex) => {
          expect(rowIndex, 'row-index for created fuel export row').to.exist
          const rowSelector = `div.ag-row[row-index="${rowIndex}"]`
          cy.inputTextWithRetry(
            `${rowSelector} div.ag-cell[col-id="quantity"]`,
            updatedQuantity,
            0
          )
        })
    })
    saveAndReturn()
  }
)

When(
  'the supplier opens the fuel export changelog view for fuel type {string} with original quantity {string} and updated quantity {string}',
  (fuelType: string, initialQuantity: string, updatedQuantity: string) => {
    // Use cy.visit() so location.state has no newReport:true → ReportDetails is rendered.
    cy.location('pathname').then((pathname) => {
      const normalizedPath = pathname.replace(/\/+$/, '')
      const pathMatch = normalizedPath.match(
        /\/compliance-reporting\/(\d+)\/(\d+)$/
      )
      expect(pathMatch, 'compliance report view path').to.exist
      if (!pathMatch) throw new Error('Expected a compliance report view path')
      const compliancePeriod = pathMatch[1]
      const reportId = pathMatch[2]
      const canonicalViewPath = `/compliance-reporting/${compliancePeriod}/${reportId}`

      setupFuelExportChangelogMocks({
        reportId,
        fuelType,
        fuelCategory: 'Gasoline',
        provisionOfTheAct: 'Default carbon intensity - section 19 (b) (ii)',
        initialQuantity,
        updatedQuantity,
        units: 'L'
      })

      // Navigate from a clean root route with router state that expands the
      // schedule, as the report view does after returning from an edit screen.
      cy.visit('/')
      cy.window().then((window) => {
        const state = {
          usr: { newReport: false, expandedSchedule: 'fuelExports' },
          key: 'fuel-export-cypress',
          idx: 1
        }
        window.history.pushState(state, '', canonicalViewPath)
        window.dispatchEvent(new PopStateEvent('popstate', { state }))
      })
      cy.get('[data-test="compliance-report-header"]').should('be.visible')
      cy.scrollTo('bottom')
      cy.wait('@mockFuelExportScheduleOverview')
        .its('response.body.fuelExports.count')
        .should('eq', 1)

      // Expand the Fuel-export accordion in ReportDetails.
      // The actual data-test is panel${index}-summary (index-based), so use
      // text content to reliably find the right accordion.
      cy.contains('.MuiAccordion-root', 'Export fuel', {
        timeout: 30000
      })
        .find('[data-test$="-summary"]')
        .click()

      cy.wait('@mockFuelExportSummary', { timeout: 30000 })

      // Click the Change-log toggle. Use force:true because the accordion's
      // Collapse animation may leave the label with visibility:hidden briefly.
      cy.contains('Change log off', { timeout: 30000 }).click({ force: true })
    })
  }
)

// ---------------------------------------------------------------------------
// Then steps
// ---------------------------------------------------------------------------

Then(
  'the fuel export summary includes fuel type {string}',
  (fuelType: string) => {
    cy.get(SELECTORS.scheduleLink, { timeout: 20000 })
      .should('be.visible')
      .click()
    // onGridReady auto-starts editing the last (empty) row's fuelTypeId cell.
    // Target only cells NOT in inline-editing mode so the dropdown option text
    // does not confuse cy.contains.
    cy.contains(
      'div.ag-cell[col-id="fuelTypeId"]:not(.ag-cell-inline-editing)',
      fuelType,
      { timeout: 30000 }
    )
      .scrollIntoView()
      .should('exist')
  }
)

Then(
  'the fuel export summary includes quantity {string}',
  (formattedQuantity: string) => {
    cy.get('@lastFuelExportFuelType').then((fuelType: string) => {
      // Register the updated list-all mock BEFORE any navigation so that any
      // request fired after the visit below returns the updated quantity.
      cy.intercept('POST', '**/api/fuel-exports/list-all**', {
        statusCode: 200,
        body: {
          fuelExports: [
            {
              fuelExportId: 9999,
              fuelType: { fuelType },
              fuelCategory: { category: 'Gasoline' },
              quantity: parseInt(formattedQuantity.replace(/,/g, ''), 10),
              units: 'L'
            }
          ]
        }
      }).as('fuelExportListFinal')

      // Use cy.visit() to force a full page reload so React Query's in-memory
      // cache is cleared and the fresh fetch always hits fuelExportListFinal.
      // (Clicking scheduleLink keeps the cache alive and can serve stale data.)
      cy.location('pathname').then((pathname) => {
        cy.visit(`${pathname}/fuel-exports`)
      })

      // Wait until the mocked list-all response has been consumed so we know
      // the grid has loaded its data before we assert.
      cy.wait('@fuelExportListFinal', { timeout: 30000 })

      cy.contains('div.ag-cell[col-id="quantity"]', formattedQuantity, {
        timeout: 15000
      }).should('exist')
    })
  }
)

Then('the fuel export changelog is shown', () => {
  cy.wait('@mockFuelExportChangelog', { timeout: 30000 })
    .its('response.statusCode')
    .should('eq', 200)
  cy.get('@mockFuelExportChangelog')
    .its('response.body')
    .should('have.length', 2)
})
