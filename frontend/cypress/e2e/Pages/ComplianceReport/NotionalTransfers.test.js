/* eslint-disable cypress/unsafe-to-chain-command */
import { When, Then } from '@badeball/cypress-cucumber-preprocessor'

const SELECTORS = {
  scheduleLink: '[data-test="Notional transfers"]',
  saveButton: '[data-test="save-btn"]',
  addRowButton: '[data-test="add-row-btn"]'
}
const NOTIONAL_CHANGELOG_GROUP_UUID = 'mock-notional-transfers-group'

/**
 * Click the save button and wait until we are back on the compliance report
 * VIEW page (i.e. the URL ends with /<compliancePeriod>/<reportId> and has no
 * additional path segments like /notional-transfers).
 */
const saveAndReturn = () => {
  cy.get(SELECTORS.saveButton).click()
  cy.url({ timeout: 30000 }).should('match', /\/compliance-reporting\/\d+\/\d+$/)
}

/**
 * Set up cy.intercept stubs so the compliance-report page behaves as if the
 * current report belongs to a supplemental chain (hasVersions === true) and
 * the notional-transfers belong to a previous version (wasEdited === true).
 * This enables the Change-log toggle in the UI.
 */
const setupNotionalChangelogMocks = ({
  reportId,
  legalName,
  addressForService,
  fuelCategory,
  receivedOrTransferred,
  initialQuantity,
  updatedQuantity
}) => {
  const previousReportId = 991001

  // Override the report response to inject chain / group-uuid data.
  // The supplier user calls /organization/:orgID/reports/:reportID, not
  // /reports/:reportID, so match any URL ending in /reports/:reportID.
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
          complianceReportGroupUuid: NOTIONAL_CHANGELOG_GROUP_UUID
        },
        chain: [
          { complianceReportId: Number(reportId), version: 0 },
          { complianceReportId: previousReportId, version: 1 }
        ]
      }
    })
  }).as('mockNotionalReport')

  // Return a record that is associated with the *previous* report version so
  // that wasEdited() returns true and the Change-log toggle becomes enabled.
  cy.intercept('POST', '**/api/notional-transfers/list-all**', {
    statusCode: 200,
    body: {
      notionalTransfers: [
        {
          notionalTransferId: 1,
          complianceReportId: previousReportId,
          version: 1,
          legalName,
          addressForService,
          fuelCategory,
          receivedOrTransferred,
          quantity: parseInt(updatedQuantity, 10),
          actionType: 'UPDATE',
          updated: false
        }
      ]
    }
  }).as('mockNotionalSummary')

  // Stub the changelog endpoint
  cy.intercept(
    'GET',
    `**/api/reports/${NOTIONAL_CHANGELOG_GROUP_UUID}/changelog/notional-transfers**`,
    {
      statusCode: 200,
      body: [
        {
          nickname: 'Supplemental report',
          version: 1,
          notionalTransfers: [
            {
              notionalTransferId: 1,
              legalName,
              addressForService,
              fuelCategory: { category: fuelCategory },
              receivedOrTransferred,
              quantity: parseInt(updatedQuantity, 10),
              actionType: 'UPDATE',
              updated: false
            }
          ]
        },
        {
          nickname: 'Original report',
          version: 0,
          notionalTransfers: [
            {
              notionalTransferId: 1,
              legalName,
              addressForService,
              fuelCategory: { category: fuelCategory },
              receivedOrTransferred,
              quantity: parseInt(initialQuantity, 10),
              actionType: 'UPDATE',
              updated: true
            }
          ]
        }
      ]
    }
  ).as('mockNotionalChangelog')
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

When(
  'the supplier adds a notional transfer with legal name {string}, address {string}, fuel category {string}, transfer type {string}, and quantity {string}',
  (legalName, addressForService, fuelCategory, receivedOrTransferred, quantity) => {
    cy.get(SELECTORS.scheduleLink).click()
    cy.get(SELECTORS.addRowButton).click({ force: true })

    cy.get('div.ag-center-cols-container div.ag-row', { timeout: 20000 })
      .last()
      .invoke('attr', 'row-index')
      .then((rowIndex) => {
        expect(rowIndex, 'newly added notional row-index').to.exist
        const rowSelector = `div.ag-row[row-index="${rowIndex}"]`

        // legalName uses AsyncSuggestionEditor – the body click at the start of
        // the next inputTextWithRetry call will commit whatever was typed.
        cy.inputTextWithRetry(
          `${rowSelector} div.ag-cell[col-id="legalName"]`,
          legalName,
          0
        )
        cy.inputTextWithRetry(
          `${rowSelector} div.ag-cell[col-id="addressForService"]`,
          addressForService,
          0
        )
        cy.selectWithRetry(
          `${rowSelector} div.ag-cell[col-id="fuelCategory"]`,
          `[data-testid="select-${fuelCategory}"]`,
          0
        )
        cy.selectWithRetry(
          `${rowSelector} div.ag-cell[col-id="receivedOrTransferred"]`,
          `[data-testid="select-${receivedOrTransferred}"]`,
          0
        )
        cy.inputTextWithRetry(
          `${rowSelector} div.ag-cell[col-id="quantity"]`,
          quantity,
          0
        )
      })

    // Keep the created row identity for later edit assertions/updates.
    cy.wrap(legalName).as('lastNotionalLegalName')

    saveAndReturn()
  }
)

When(
  'the supplier updates the first notional transfer quantity to {string}',
  (updatedQuantity) => {
    cy.get(SELECTORS.scheduleLink).click()
    // Edit all fields on the row created in the previous step.
    cy.get('@lastNotionalLegalName').then((legalName) => {
      cy.contains('div.ag-cell[col-id="legalName"]', legalName, {
        timeout: 30000
      })
        .closest('div.ag-row')
        .invoke('attr', 'row-index')
        .then((rowIndex) => {
          expect(rowIndex, 'row-index for created notional row').to.exist
          const rowSelector = `div.ag-row[row-index="${rowIndex}"]`
          cy.inputTextWithRetry(
            `${rowSelector} div.ag-cell[col-id="addressForService"]`,
            '456 Cypress Avenue',
            0
          )
          cy.selectWithRetry(
            `${rowSelector} div.ag-cell[col-id="fuelCategory"]`,
            '[data-testid="select-Gasoline"]',
            0
          )
          cy.selectWithRetry(
            `${rowSelector} div.ag-cell[col-id="receivedOrTransferred"]`,
            '[data-testid="select-Transferred"]',
            0
          )
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
  'the supplier opens the notional transfer changelog view for {string} with original quantity {string} and updated quantity {string}',
  (legalName, initialQuantity, updatedQuantity) => {
    // We are currently on the compliance report VIEW page (after saveAndReturn).
    // Use cy.visit() (not cy.reload()) so that location.state has no newReport:true,
    // which ensures ReportDetails accordions are rendered.
    cy.location('pathname').then((pathname) => {
      const normalizedPath = pathname.replace(/\/+$/, '')
      const pathMatch = normalizedPath.match(
        /\/compliance-reporting\/(\d+)\/(\d+)$/
      )
      expect(pathMatch, 'compliance report view path').to.exist
      const compliancePeriod = pathMatch[1]
      const reportId = pathMatch[2]
      const canonicalViewPath = `/compliance-reporting/${compliancePeriod}/${reportId}`

      setupNotionalChangelogMocks({
        reportId,
        legalName,
        addressForService: '123 Cypress Street',
        fuelCategory: 'Diesel',
        receivedOrTransferred: 'Received',
        initialQuantity,
        updatedQuantity
      })

      // Fresh visit so location.state is null → ReportDetails is rendered.
      // Always use canonical path shape (no trailing slash).
      cy.visit(canonicalViewPath)

      // Wait for the mocked notional-transfers list to be fetched on page load.
      cy.wait('@mockNotionalSummary', { timeout: 30000 })

      // Expand the Notional-transfers accordion in ReportDetails.
      // The actual data-test is panel${index}-summary (index-based), so use
      // text content to reliably find the right accordion.
      cy.contains(
        '[data-test$="-summary"]',
        'Notional transfers of eligible renewable fuel',
        { timeout: 30000 }
      ).click()

      // Click the Change-log toggle (it reads "Change log off" when inactive).
      // Use force:true because the accordion's Collapse animation may briefly
      // leave the label with visibility:hidden while it transitions.
      cy.contains('Change log off', { timeout: 30000 }).click({ force: true })
    })
  }
)

// ---------------------------------------------------------------------------
// Then steps
// ---------------------------------------------------------------------------

Then('the notional transfer summary includes legal name {string}', (legalName) => {
  // Navigate back to the schedule page and confirm the grid row is visible.
  cy.get(SELECTORS.scheduleLink, { timeout: 20000 }).should('be.visible').click()
  cy.contains('[col-id="legalName"]', legalName, { timeout: 30000 })
    .scrollIntoView()
    .should('exist')
})

Then(
  'the notional transfer summary includes quantity {string}',
  (formattedQuantity) => {
    cy.get(SELECTORS.scheduleLink, { timeout: 20000 }).should('be.visible').click()
    // Assert quantity on the same row as the created legal name.
    cy.get('@lastNotionalLegalName').then((legalName) => {
      cy.contains('div.ag-cell[col-id="legalName"]', legalName, {
        timeout: 30000
      })
        .closest('div.ag-row')
        .within(() => {
          cy.contains('[col-id="quantity"]', formattedQuantity, {
            timeout: 30000
          }).should('exist')
        })
    })
  }
)

Then('the notional transfer changelog is shown', () => {
  // The Change-log toggle click in the When step triggers the changelog fetch.
  cy.wait('@mockNotionalChangelog', { timeout: 30000 })
    .its('response.statusCode')
    .should('eq', 200)
  cy.get('@mockNotionalChangelog')
    .its('response.body')
    .should('have.length', 2)
})
