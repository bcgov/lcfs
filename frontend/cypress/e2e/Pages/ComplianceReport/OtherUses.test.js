/* eslint-disable cypress/unsafe-to-chain-command */
import { When, Then } from '@badeball/cypress-cucumber-preprocessor'

const SELECTORS = {
  scheduleLink: '[data-test="Fuels for other use"]',
  saveButton: '[data-test="save-btn"]',
  addRowButton: '[data-test="add-row-btn"]'
}
const OTHER_USES_CHANGELOG_GROUP_UUID = 'mock-other-uses-group'

/**
 * Click the save button and wait until we are back on the compliance report
 * VIEW page (URL ends with /<compliancePeriod>/<reportId> with no extra path).
 */
const saveAndReturn = () => {
  cy.get(SELECTORS.saveButton).click()
  cy.url({ timeout: 30000 }).should('match', /\/compliance-reporting\/\d+\/\d+$/)
}

/**
 * Set up cy.intercept stubs so the compliance-report page behaves as if the
 * current report belongs to a supplemental chain (hasVersions === true) and
 * the other-uses records belong to a previous version (wasEdited === true).
 */
const setupOtherUsesChangelogMocks = ({
  reportId,
  fuelType,
  fuelCategory,
  provisionOfTheAct,
  initialQuantity,
  updatedQuantity,
  units,
  expectedUse
}) => {
  const previousReportId = 991002

  // Supplier users call /organization/:orgID/reports/:reportID, not /reports/:reportID,
  // so match any URL containing /reports/:reportID.
  //
  // Use req.on('before:response') instead of req.continue() to avoid
  // the "Socket closed before finished writing response" race condition
  // that occurs when the browser connection closes mid-proxy write.
  cy.intercept('GET', `**/reports/${reportId}**`, (req) => {
    req.on('before:response', (res) => {
      const report = res.body?.report || {}
      res.body = {
        ...res.body,
        report: {
          ...report,
          complianceReportGroupUuid: OTHER_USES_CHANGELOG_GROUP_UUID
        },
        chain: [
          { complianceReportId: Number(reportId), version: 0 },
          { complianceReportId: previousReportId, version: 1 }
        ]
      }
    })
  }).as('mockOtherUsesReport')

  cy.intercept('POST', '**/api/other-uses/list-all**', {
    statusCode: 200,
    body: {
      otherUses: [
        {
          otherUsesId: 1,
          complianceReportId: previousReportId,
          version: 1,
          fuelType,
          fuelCategory,
          provisionOfTheAct,
          quantitySupplied: parseInt(updatedQuantity, 10),
          units,
          expectedUse,
          ciOfFuel: 93.67,
          actionType: 'UPDATE',
          updated: false
        }
      ]
    }
  }).as('mockOtherUsesSummary')

  cy.intercept(
    'GET',
    `**/api/reports/${OTHER_USES_CHANGELOG_GROUP_UUID}/changelog/other-uses**`,
    {
      statusCode: 200,
      body: [
        {
          nickname: 'Supplemental report',
          version: 1,
          otherUses: [
            {
              otherUsesId: 1,
              fuelType: { fuelType },
              fuelCategory: { category: fuelCategory },
              provisionOfTheAct: { name: provisionOfTheAct },
              quantitySupplied: parseInt(updatedQuantity, 10),
              units,
              expectedUse: { name: expectedUse },
              actionType: 'UPDATE',
              updated: false
            }
          ]
        },
        {
          nickname: 'Original report',
          version: 0,
          otherUses: [
            {
              otherUsesId: 1,
              fuelType: { fuelType },
              fuelCategory: { category: fuelCategory },
              provisionOfTheAct: { name: provisionOfTheAct },
              quantitySupplied: parseInt(initialQuantity, 10),
              units,
              expectedUse: { name: expectedUse },
              actionType: 'UPDATE',
              updated: true
            }
          ]
        }
      ]
    }
  ).as('mockOtherUsesChangelog')
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

When(
  'the supplier adds an other uses record with fuel type {string}, fuel category {string}, provision {string}, quantity {string}, units {string}, and expected use {string}',
  (fuelType, fuelCategory, provisionOfTheAct, quantitySupplied, units, expectedUse) => {
    cy.get(SELECTORS.scheduleLink).click()
    cy.get(SELECTORS.addRowButton).click({ force: true })

    cy.get('div.ag-center-cols-container div.ag-row', { timeout: 20000 })
      .last()
      .invoke('attr', 'row-index')
      .then((rowIndex) => {
        expect(rowIndex, 'newly added other uses row-index').to.exist
        const rowSelector = `div.ag-row[row-index="${rowIndex}"]`

        cy.selectWithRetry(
          `${rowSelector} div.ag-cell[col-id="fuelType"]`,
          `[data-testid="select-${fuelType}"]`,
          0
        )
        cy.selectWithRetry(
          `${rowSelector} div.ag-cell[col-id="fuelCategory"]`,
          `[data-testid="select-${fuelCategory}"]`,
          0
        )
        cy.selectWithRetry(
          `${rowSelector} div.ag-cell[col-id="provisionOfTheAct"]`,
          `[data-testid="select-${provisionOfTheAct}"]`,
          0
        )
        cy.inputTextWithRetry(
          `${rowSelector} div.ag-cell[col-id="quantitySupplied"]`,
          quantitySupplied,
          0
        )
        cy.selectWithRetry(
          `${rowSelector} div.ag-cell[col-id="units"]`,
          `[data-testid="select-${units}"]`,
          0
        )
        cy.selectWithRetry(
          `${rowSelector} div.ag-cell[col-id="expectedUse"]`,
          `[data-testid="select-${expectedUse}"]`,
          0
        )
      })

    // Alias the fuel type so the edit and assertion steps can target the same row.
    cy.wrap(fuelType).as('lastOtherUsesFuelType')

    saveAndReturn()
  }
)

When(
  'the supplier updates the first other uses quantity to {string}',
  (updatedQuantity) => {
    cy.get(SELECTORS.scheduleLink).click()
    // Edit the existing row created in the previous step.
    cy.get('@lastOtherUsesFuelType').then((fuelType) => {
      cy.contains('div.ag-cell[col-id="fuelType"]', fuelType, {
        timeout: 30000
      })
        .closest('div.ag-row')
        .invoke('attr', 'row-index')
        .then((rowIndex) => {
          expect(rowIndex, 'row-index for created other uses row').to.exist
          const rowSelector = `div.ag-row[row-index="${rowIndex}"]`
          cy.inputTextWithRetry(
            `${rowSelector} div.ag-cell[col-id="quantitySupplied"]`,
            updatedQuantity,
            0
          )
        })
    })
    saveAndReturn()
  }
)

When(
  'the supplier opens the other uses changelog view for fuel type {string} with original quantity {string} and updated quantity {string}',
  (fuelType, initialQuantity, updatedQuantity) => {
    // Use cy.visit() so location.state has no newReport:true → ReportDetails is rendered.
    cy.location('pathname').then((pathname) => {
      const normalizedPath = pathname.replace(/\/+$/, '')
      const pathMatch = normalizedPath.match(
        /\/compliance-reporting\/(\d+)\/(\d+)$/
      )
      expect(pathMatch, 'compliance report view path').to.exist
      const compliancePeriod = pathMatch[1]
      const reportId = pathMatch[2]
      const canonicalViewPath = `/compliance-reporting/${compliancePeriod}/${reportId}`

      setupOtherUsesChangelogMocks({
        reportId,
        fuelType,
        fuelCategory: 'Gasoline',
        provisionOfTheAct: 'Default carbon intensity - section 19 (b) (ii)',
        initialQuantity,
        updatedQuantity,
        units: 'L',
        expectedUse: 'Heating oil'
      })

      // Fresh visit so location.state is null → ReportDetails accordions render.
      // Always use canonical path shape (no trailing slash).
      cy.visit(canonicalViewPath)

      cy.wait('@mockOtherUsesSummary', { timeout: 30000 })

      // Expand the Other-uses accordion in ReportDetails.
      // The actual data-test is panel${index}-summary (index-based), so use
      // text content to reliably find the right accordion.
      cy.contains('[data-test$="-summary"]', 'Fuels for other use', {
        timeout: 30000
      }).click()

      // Click the Change-log toggle. Use force:true because the accordion's
      // Collapse animation may leave the label with visibility:hidden briefly.
      cy.contains('Change log off', { timeout: 30000 }).click({ force: true })
    })
  }
)

// ---------------------------------------------------------------------------
// Then steps
// ---------------------------------------------------------------------------

Then('the other uses summary includes fuel type {string}', (fuelType) => {
  cy.get(SELECTORS.scheduleLink, { timeout: 20000 }).should('be.visible').click()
  cy.contains('[col-id="fuelType"]', fuelType, { timeout: 30000 })
    .scrollIntoView()
    .should('exist')
})

Then('the other uses summary includes quantity {string}', (formattedQuantity) => {
  cy.get(SELECTORS.scheduleLink, { timeout: 20000 }).should('be.visible').click()
  // Assert quantity on the same row as the created fuel type.
  cy.get('@lastOtherUsesFuelType').then((fuelType) => {
    cy.contains('div.ag-cell[col-id="fuelType"]', fuelType, {
      timeout: 30000
    })
      .closest('div.ag-row')
      .within(() => {
        cy.contains('[col-id="quantitySupplied"]', formattedQuantity, {
          timeout: 30000
        }).should('exist')
      })
  })
})

Then('the other uses changelog is shown', () => {
  cy.wait('@mockOtherUsesChangelog', { timeout: 30000 })
    .its('response.statusCode')
    .should('eq', 200)
  cy.get('@mockOtherUsesChangelog')
    .its('response.body')
    .should('have.length', 2)
})
