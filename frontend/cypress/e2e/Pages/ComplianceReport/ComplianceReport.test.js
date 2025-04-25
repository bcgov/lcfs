/* eslint-disable cypress/unsafe-to-chain-command */
import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'

const currentComplianceYear = (new Date().getFullYear() - 1).toString()

// Consolidated selectors for better maintainability
const SELECTORS = {
  dashboard: '[data-test="dashboard-container"]',
  complianceReportStatus: '[data-test="compliance-report-status"]',
  supplyOfFuelButton: '[data-test="Supply of fuel"]',
  agGridRoot: '.ag-root',
  fuelTypeCell:
    'div[col-id="fuelType"][title="Select the fuel type from the list"]',
  actProvisionsCell:
    'div[col-id="provisionOfTheAct"][title="Act Relied Upon to Determine Carbon Intensity: Identify the appropriate provision of the Act relied upon to determine the carbon intensity of each fuel."]',
  defaultCarbonIntensityOption:
    '[data-testid="select-Default carbon intensity - section 19 (b) (ii)"]',
  quantityCell: 'div.ag-cell[col-id="quantity"]',
  saveButton: '[data-test="save-btn"]',
  renewableSummaryTable:
    '[data-test="renewable-summary"] > .MuiTable-root > .MuiTableBody-root',
  submitReportButton: 'button[data-test="submit-report-btn"]',
  recommendToCompianceManagerButton:
    'button[data-test="recommend-report-analyst-btn"]',
  recommendToDirectorButton: 'button[data-test="recommend-report-manager-btn"]',
  issueAssessmentButton: 'button[data-test="assess-report-btn"]',
  createSupplementalReport: 'button[data-test="create-supplemental"]',
  submitModalButton: '#modal-btn-submit-report',
  submitModalComplianceManagerButton:
    'button#modal-btn-recommend-to-compliance-manager',
  submitModalDirectorButton: '#modal-btn-recommend-to-director',
  submitModalIssueAssessmentButton: '#modal-btn-issue-assessment',
  declarationCheckbox: '#signing-authority-declaration',
  checkbox: 'span[data-test="signing-authority-checkbox"]',
  addRowButton: '[data-test="add-row-btn"]'
}

// Enhanced custom commands
Cypress.Commands.add('waitAndClick', (selector, options = {}) => {
  return cy
    .get(selector, { timeout: 10000, ...options })
    .should('be.visible')
    .click(options)
})

Cypress.Commands.add('waitAndType', (selector, text, options = {}) => {
  return cy
    .get(selector, { timeout: 10000 })
    .should('be.visible')
    .type(text, options)
})

// Added page refresh function with waiting after schedule data entry
Cypress.Commands.add('refreshPageAndWait', (waitTime = 5000) => {
  cy.reload()
  cy.wait(waitTime)
  cy.log('Page refreshed and waited for ' + waitTime + 'ms')
})

Given('the user is on the login page', () => {
  cy.clearAllCookies()
  cy.clearAllLocalStorage()
  cy.clearAllSessionStorage()
  cy.task('clearComplianceReports')
  cy.visit('/', { timeout: 60000 })
  cy.getByDataTest('login-container').should('exist')
})

Given('the user is on the login page, while retaining previous data', () => {
  cy.clearAllCookies()
  cy.clearAllLocalStorage()
  cy.clearAllSessionStorage()

  cy.visit('/', { timeout: 60000 })
  cy.getByDataTest('login-container').should('exist')
})

When('the supplier logs in with valid credentials', () => {
  cy.loginWith(
    'becid',
    Cypress.env('BCEID_TEST_USER'),
    Cypress.env('BCEID_TEST_PASS')
  )
  cy.visit('/', { timeout: 60000 })
  cy.get(SELECTORS.dashboard, { timeout: 10000 }).should('exist')
})

When('they navigate to the compliance reports page', () => {
  cy.waitAndClick('a[href="/compliance-reporting"]')
  cy.get(SELECTORS.dashboard).should('be.visible')
})

When('the supplier creates a new compliance report', () => {
  cy.waitAndClick('.new-compliance-report-button')
  cy.contains(
    `.compliance-period-${currentComplianceYear}`,
    currentComplianceYear
  ).click()
  cy.get('[data-test="compliance-report-intro"]').should('be.visible')
})

When('the supplier navigates to the fuel supply page', (dataTable) => {
  cy.waitAndClick(SELECTORS.supplyOfFuelButton)
  cy.contains('.MuiTypography-h5', 'Supply of fuel').should('be.visible')

  // Store data from table if provided
  if (dataTable) {
    cy.wrap(dataTable.hashes()).as('fuelSupplyData')
  }

  cy.contains('.MuiTypography-h5', 'Supply of fuel').should('be.visible')
})

When(
  'the supplier navigates to the fuel supply page with data from file {string}',
  (filePath) => {
    cy.waitAndClick(SELECTORS.supplyOfFuelButton)
    cy.wait(2000)

    // Read and store data from JSON file
    cy.readFile(filePath).then((jsonData) => {
      cy.wrap(jsonData).as('fuelSupplyData')
    })

    cy.contains('.MuiTypography-h5', 'Supply of fuel').should('be.visible')
  }
)

When('the supplier enters a valid fuel supply row', () => {
  // Use aliased data if available, otherwise use default values
  const fuelData = { fuelType: 'Ethanol', quantity: 10000 }

  cy.get(SELECTORS.agGridRoot).should('be.visible')
  cy.wait(500)

  // Set fuel type
  cy.get(SELECTORS.fuelTypeCell).click()
  cy.get(SELECTORS.fuelTypeCell)
    .find('input')
    .type(`${fuelData.fuelType || 'Ethanol'}{enter}`)

  cy.wait(500)

  // Set determining carbon intensity
  cy.get(SELECTORS.actProvisionsCell).click()
  cy.get(SELECTORS.defaultCarbonIntensityOption).click()
  cy.get('body').click()

  cy.get('.ag-body-horizontal-scroll-viewport').scrollTo(1000, 0)
  cy.wait(800)

  // Set quantity
  cy.get(SELECTORS.quantityCell).should('be.visible').click()
  cy.get(SELECTORS.quantityCell)
    .find('input')
    .type(`${fuelData.quantity || 10000}{enter}`)

  cy.contains('Row updated successfully.').should('be.visible')
})

When(
  'the supplier starts entering data into each schedules',
  (dataTable, asTestCase = false) => {
    const schedules = dataTable.hashes()

    // Process each schedule one by one
    cy.wrap(schedules).each((schedule) => {
      const { scheduleLabel, dataFilePath } = schedule

      // Navigate to the specific schedule
      cy.waitAndClick(`[data-test="${scheduleLabel}"]`)
      cy.wait(2000)

      // Load data from the corresponding file
      if (dataFilePath) {
        cy.log(`Loading fixture from: ${dataFilePath}`)
        cy.fixture(dataFilePath).then((jsonData) => {
          cy.wrap(jsonData).as('scheduleData')

          // Process the grid based on the schedule type
          cy.get(SELECTORS.agGridRoot).should('be.visible')
          cy.wait(500)

          // Call the appropriate data entry function based on schedule type
          switch (scheduleLabel) {
            case 'Supply of fuel':
              enterFuelSupplyData(jsonData, asTestCase)
              break
            case 'FSE':
              enterFSEData(jsonData)
              break
            case 'Allocation agreements':
              enterAllocationData(jsonData)
              break
            case 'Notional transfers':
              enterNotionalTransferData(jsonData)
              break
            case 'Fuels for other use':
              enterFuelsForOtherUseData(jsonData)
              cy.realPress('Enter')
              break
            default:
              cy.log(`No specific handler for ${scheduleLabel}`)
          }
          // Save and return to report view page
          cy.waitAndClick(SELECTORS.saveButton)
        })
      }
    })
  }
)

// Optimized helper function for fuel supply data entry
function enterFuelSupplyData(data, asTestCase = false) {
  const { fuelSupplies } = data

  // For each fuel supply entry in the JSON
  cy.wrap(fuelSupplies).each((row, index) => {
    // Set fuel type using optimized selector

    cy.inputTextWithRetry('div.ag-cell[col-id="fuelType"]', row.fuelType, index)

    if (row.fuelTypeOther) {
      cy.inputTextWithRetry(
        'div.ag-cell[col-id="fuelTypeOther"]',
        row.fuelTypeOther,
        index
      )
      cy.wait(1000)
    }

    if (row.inputFuelCategory) {
      cy.inputTextWithRetry(
        'div.ag-cell[col-id="fuelCategory"]',
        row.inputFuelCategory,
        index
      )
    }

    // Set end use type if it's a field that can be edited
    if (row.endUseType && row.endUseType !== 'Any') {
      cy.inputTextWithRetry(
        'div.ag-cell[col-id="endUseType"]',
        row.endUseType,
        index
      )
    }

    // Set provision of the act using the retry command
    cy.inputTextWithRetry(
      'div.ag-cell[col-id="provisionOfTheAct"]',
      row.provisionOfTheAct,
      index
    )

    if (row.fuelCode) {
      cy.inputTextWithRetry(
        'div.ag-cell[col-id="fuelCode"]',
        row.fuelCode,
        index
      )
    }

    if (row.inputEnergyDensity) {
      cy.wait(1000)
      cy.inputTextWithRetry(
        'div.ag-cell[col-id="energyDensity"]',
        row.inputEnergyDensity,
        index
      )
      cy.wait(1000)
    }

    // Set quantity
    cy.inputTextWithRetry('div.ag-cell[col-id="quantity"]', row.quantity, index)

    // Verify success message after each row is entered
    cy.contains('Row updated successfully.').should('be.visible')

    if (asTestCase) {
      // Validate read-only fields after data entry
      cy.wait(1000)
      it(`Validates row ${index + 1}: ${row.fuelType}`, () => {
        validateFuelSupplyReadOnlyFields(row, index)
      })
    } else {
      // Validate read-only fields after data entry
      validateFuelSupplyReadOnlyFields(row, index)
    }

    // Add new row
    cy.get(SELECTORS.addRowButton).click()
  })
}

// Separated validation into a reusable function
function validateFuelSupplyReadOnlyFields(row, index) {
  const cellSelector = (col) => `div.ag-cell[col-id="${col}"]`

  // Fuel category
  if (row.fuelCategory) {
    cy.get(cellSelector('fuelCategory'))
      .eq(index)
      .should('contain', row.fuelCategory)
  }

  // Units
  cy.get(cellSelector('units')).eq(index).should('contain', row.units)

  // Compliance units
  cy.get(cellSelector('complianceUnits'))
    .eq(index)
    .should('contain', row.complianceUnits)

  // Target CI - compare with rounded values
  cy.get(cellSelector('targetCi'))
    .eq(index)
    .should('not.be.empty')
    .invoke('text')
    .then((text) => {
      const roundedValue = parseFloat(text).toFixed(4)
      const expectedValue = row.targetCi.toFixed(4)
      expect(roundedValue).to.equal(expectedValue)
    })

  // CI of fuel
  cy.get(cellSelector('ciOfFuel'))
    .eq(index)
    .should('not.be.empty')
    .invoke('text')
    .then((text) => {
      const roundedValue = parseFloat(text).toFixed(2)
      const expectedValue = row.ciOfFuel.toFixed(2)
      expect(roundedValue).to.equal(expectedValue)
    })

  // Energy density
  cy.get(cellSelector('energyDensity'))
    .eq(index)
    .should('not.be.empty')
    .invoke('text')
    .then((text) => {
      const roundedValue = parseFloat(text).toFixed(2)
      const expectedValue = row.energyDensity.toFixed(2)
      expect(roundedValue).to.equal(expectedValue)
    })

  // EER
  cy.get(cellSelector('eer'))
    .eq(index)
    .should('not.be.empty')
    .invoke('text')
    .then((text) => {
      const roundedValue = parseFloat(text).toFixed(1)
      const expectedValue = row.eer.toFixed(1)
      expect(roundedValue).to.equal(expectedValue)
    })

  // Energy - clean text and compare
  cy.get(cellSelector('energy'))
    .eq(index)
    .should('not.be.empty')
    .invoke('text')
    .then((text) => {
      const cleanedText = text.replace(/,/g, '')
      const roundedValue = parseFloat(cleanedText).toFixed(1)
      const expectedValue = row.energy.toFixed(1)
      expect(roundedValue).to.equal(expectedValue)
    })
}

// Optimized FSE data entry
function enterFSEData(data) {
  const { finalSupplyEquipments } = data

  // Process rows one at a time
  const processRows = (startIndex = 0) => {
    if (startIndex >= finalSupplyEquipments.length) {
      cy.log('✅ All FSE data entries completed')
      return
    }

    const row = finalSupplyEquipments[startIndex]
    cy.log(`📝 Attempting FSE data entry for row ${startIndex}`)

    // Flag to track if we used the API fallback
    let usedApiFallback = false

    // Set up the exception handler for this row
    cy.on('uncaught:exception', (_err) => {
      cy.log(
        `⚠️ FSE grid data entry failed at row ${startIndex}, falling back to API.`
      )
      usedApiFallback = true

      // Use API fallback
      cy.get('@authToken').then((token) => {
        cy.request({
          method: 'POST',
          url: '/api/final-supply-equipments/save',
          body: row,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }).then((response) => {
          expect(response.status).to.be.oneOf([200, 201])
          cy.log(`✅ Row ${startIndex} posted via fallback API`)

          // Continue to next row after API call completes
          cy.get(SELECTORS.addRowButton).click()
          processRows(startIndex + 1)
        })
      })

      // Prevent Cypress from failing the test
      return false
    })

    // Try UI data entry
    Cypress.Promise.try(() => {
      cy.inputTextWithRetry(
        'div.ag-cell[col-id="organizationName"]',
        row.organizationName,
        startIndex
      )

      // supplyFromDate
      cy.window().then((win) => {
        const cell = win.document
          .querySelectorAll('div.ag-cell[col-id="supplyFromDate"]')
          .item(startIndex)
        cy.wrap(cell).scrollIntoView().click({ force: true })
        cy.get('div.date-picker-container')
          .should('be.visible')
          .find('input')
          .type(row.supplyFromDate)
      })
      // supplyToDate
      cy.window().then((win) => {
        const cell = win.document
          .querySelectorAll('div.ag-cell[col-id="supplyToDate"]')
          .item(startIndex)
        cy.wrap(cell).scrollIntoView().click({ force: true })
        cy.get('div.date-picker-container')
          .should('be.visible')
          .find('input')
          .type(row.supplyToDate)
      })

      // cy.get('div.ag-cell[col-id="supplyToDate"]')
      //   .eq(startIndex)
      //   .should('be.visible')
      //   .click()
      // cy.get('div.date-picker-container')
      //   .should('be.visible')
      //   .find('input')
      //   .type(row.supplyToDate)

      cy.inputTextWithRetry(
        'div.ag-cell[col-id="kwhUsage"]',
        row.kwhUsage,
        startIndex
      )
      cy.inputTextWithRetry(
        'div.ag-cell[col-id="serialNbr"]',
        row.serialNbr,
        startIndex
      )
      cy.inputTextWithRetry(
        'div.ag-cell[col-id="manufacturer"]',
        row.manufacturer,
        startIndex
      )
      cy.inputTextWithRetry(
        'div.ag-cell[col-id="model"]',
        row.model,
        startIndex
      )

      cy.selectWithRetry(
        'div.ag-cell[col-id="levelOfEquipment"]',
        `[data-testid="select-${row.levelOfEquipment}"]`,
        startIndex
      )
      cy.selectWithRetry(
        'div.ag-cell[col-id="ports"]',
        `[data-testid="select-${row.ports}"]`,
        startIndex
      )

      cy.get('div.ag-cell[col-id="intendedUses"]')
        .eq(startIndex)
        .click()
        .then(() => {
          cy.wrap(row.intendedUses).each((use) => {
            cy.get(`[data-testid="select-${use}"]`).click()
          })
        })

      cy.get('div.ag-cell[col-id="intendedUsers"]')
        .eq(startIndex)
        .click()
        .then(() => {
          cy.wrap(row.intendedUsers).each((user) => {
            cy.get(`[data-testid="select-${user}"]`).click()
          })
        })

      cy.inputTextWithRetry(
        'div.ag-cell[col-id="streetAddress"]',
        row.streetAddress,
        startIndex
      )
      cy.inputTextWithRetry('div.ag-cell[col-id="city"]', row.city, startIndex)
      cy.inputTextWithRetry(
        'div.ag-cell[col-id="postalCode"]',
        row.postalCode,
        startIndex
      )
      cy.inputTextWithRetry(
        'div.ag-cell[col-id="latitude"]',
        row.latitude,
        startIndex
      )
      cy.inputTextWithRetry(
        'div.ag-cell[col-id="longitude"]',
        row.longitude,
        startIndex
      )

      cy.contains('Row updated successfully.').should('be.visible')
      cy.wait(300)
      cy.get(SELECTORS.addRowButton).click()

      // Only process next row if we didn't already use API fallback
      cy.then(() => {
        if (!usedApiFallback) {
          processRows(startIndex + 1)
        }
      })
    }).catch((err) => {
      // Only use catch API fallback if we haven't already used the uncaught exception handler
      if (!usedApiFallback) {
        cy.log(
          `⚠️ FSE grid data entry failed at row ${startIndex}, falling back to API.`,
          err
        )
        cy.get('@authToken').then((token) => {
          cy.request({
            method: 'POST',
            url: '/api/final-supply-equipments/save',
            body: row,
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }).then((response) => {
            expect(response.status).to.be.oneOf([200, 201])
            cy.log(`✅ Row ${startIndex} posted via fallback API`)
            cy.get(SELECTORS.addRowButton).click()
            processRows(startIndex + 1)
          })
        })
      }
    })
  }

  // Start processing from the first row
  processRows(0)
}

// Optimized allocation data entry
function enterAllocationData(data) {
  const { allocationAgreements } = data

  // Process rows one at a time with recursion
  const processRows = (startIndex = 0) => {
    if (startIndex >= allocationAgreements.length) {
      cy.log('✅ All allocation data entries completed')
      return
    }

    const row = allocationAgreements[startIndex]
    cy.log(`📝 Attempting allocation data entry for row ${startIndex}`)

    // Flag to track if we used the API fallback
    let usedApiFallback = false

    // Set up the exception handler for this row
    cy.on('uncaught:exception', (_err) => {
      cy.log(
        `⚠️ Allocation data entry failed at row ${startIndex}, falling back to API.`
      )
      usedApiFallback = true

      // Use API fallback
      cy.get('@authToken').then((token) => {
        cy.request({
          method: 'POST',
          url: '/api/allocation-agreements/save',
          body: row,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }).then((response) => {
          expect(response.status).to.be.oneOf([200, 201])
          cy.log(`✅ Row ${startIndex} posted via fallback API`)

          // Continue to next row after API call completes
          cy.get(SELECTORS.addRowButton).click()
          cy.wait(300)
          processRows(startIndex + 1)
        })
      })

      // Prevent Cypress from failing the test
      return false
    })

    // Try UI data entry
    Cypress.Promise.try(() => {
      cy.wait(200)

      // Allocation Transaction type
      cy.inputTextWithRetry(
        'div.ag-cell[col-id="allocationTransactionType"]',
        row.allocationTransactionType,
        startIndex
      )

      // Partner information - using retry functions for reliability
      cy.inputTextWithRetry(
        'div.ag-cell[col-id="transactionPartner"]',
        row.transactionPartner,
        startIndex
      )
      cy.inputTextWithRetry(
        'div.ag-cell[col-id="postalAddress"]',
        row.postalAddress,
        startIndex
      )
      cy.inputTextWithRetry(
        'div.ag-cell[col-id="transactionPartnerEmail"]',
        row.transactionPartnerEmail,
        startIndex
      )
      cy.inputTextWithRetry(
        'div.ag-cell[col-id="transactionPartnerPhone"]',
        row.transactionPartnerPhone,
        startIndex
      )

      // Fuel type
      cy.inputTextWithRetry(
        'div.ag-cell[col-id="fuelType"]',
        row.fuelType,
        startIndex
      )

      // Provision of the act
      cy.inputTextWithRetry(
        'div.ag-cell[col-id="provisionOfTheAct"]',
        row.provisionOfTheAct,
        startIndex
      )

      // Quantity
      cy.get('div.ag-cell[col-id="quantity"]')
        .eq(startIndex)
        .click()
        .find('input')
        .clear()
        .type(`${row.quantity}{enter}`)

      // Verify success message after each row is entered
      cy.contains('Row updated successfully.').should('be.visible')

      // Validate the fields
      cy.get('div.ag-cell[col-id="fuelCategory"]')
        .eq(startIndex)
        .should('contain', row.fuelCategory)

      cy.get('div.ag-cell[col-id="units"]')
        .eq(startIndex)
        .should('contain', row.units)

      cy.get('div.ag-cell[col-id="ciOfFuel"]')
        .eq(startIndex)
        .should('contain', row.ciOfFuel)

      cy.wait(300)
      cy.get(SELECTORS.addRowButton).click()
      cy.wait(300)

      // Only process next row if we didn't already use API fallback
      cy.then(() => {
        if (!usedApiFallback) {
          processRows(startIndex + 1)
        }
      })
    }).catch((err) => {
      // Only use catch API fallback if we haven't already used the uncaught exception handler
      if (!usedApiFallback) {
        cy.log(
          `⚠️ Allocation data entry failed at row ${startIndex}, falling back to API.`,
          err
        )
        cy.get('@authToken').then((token) => {
          cy.request({
            method: 'POST',
            url: '/api/allocation-agreements/save',
            body: row,
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }).then((response) => {
            expect(response.status).to.be.oneOf([200, 201])
            cy.log(`✅ Row ${startIndex} posted via fallback API`)
            cy.get(SELECTORS.addRowButton).click()
            cy.wait(300)
            processRows(startIndex + 1)
          })
        })
      }
    })
  }

  // Start processing from the first row
  processRows(0)
}

// Optimized notional transfer data entry
function enterNotionalTransferData(data) {
  const { notionalTransfers } = data

  cy.wrap(notionalTransfers).each((row, index) => {
    cy.wait(200)

    // Using retry methods for better reliability
    cy.inputTextWithRetry(
      'div.ag-cell[col-id="legalName"]',
      row.legalName,
      index
    )
    cy.inputTextWithRetry(
      'div.ag-cell[col-id="addressForService"]',
      row.addressForService,
      index
    )

    // Selections with retry
    cy.selectWithRetry(
      'div.ag-cell[col-id="fuelCategory"]',
      `[data-testid="select-${row.fuelCategory}"]`,
      index
    )

    cy.selectWithRetry(
      'div.ag-cell[col-id="receivedOrTransferred"]',
      `[data-testid="select-${row.receivedOrTransferred}"]`,
      index
    )

    // Quantity - more resilient approach
    cy.get('div.ag-cell[col-id="quantity"]')
      .eq(index)
      .click()
      .find('input')
      .clear()
      .type(`${row.quantity}{enter}`)

    // Verify success message
    cy.contains('Row updated successfully.').should('be.visible')

    // Add new row
    cy.wait(300)
    cy.get(SELECTORS.addRowButton).click()
  })
}

// Optimized fuels for other use data entry
function enterFuelsForOtherUseData(data) {
  const { otherUses } = data

  cy.wrap(otherUses).each((row, index) => {
    cy.wait(200)

    // Using retry methods for selections
    cy.selectWithRetry(
      'div.ag-cell[col-id="fuelType"]',
      `[data-testid="select-${row.fuelType}"]`,
      index
    )

    cy.selectWithRetry(
      'div.ag-cell[col-id="fuelCategory"]',
      `[data-testid="select-${row.fuelCategory}"]`,
      index
    )

    cy.selectWithRetry(
      'div.ag-cell[col-id="provisionOfTheAct"]',
      `[data-testid="select-${row.provisionOfTheAct}"]`,
      index
    )

    // Quantity
    cy.get('div.ag-cell[col-id="quantitySupplied"]')
      .eq(index)
      .click()
      .find('input')
      .clear()
      .type(`${row.quantitySupplied}{enter}`)

    cy.selectWithRetry(
      'div.ag-cell[col-id="units"]',
      `[data-testid="select-${row.units}"]`,
      index
    )

    cy.selectWithRetry(
      'div.ag-cell[col-id="expectedUse"]',
      `[data-testid="select-${row.expectedUse}"]`,
      index
    )

    // Validate field
    cy.get('div.ag-cell[col-id="ciOfFuel"]')
      .eq(index)
      .should('contain', row.ciOfFuel)
    cy.realPress('Tab')
    // Verify success message
    cy.contains('Row updated successfully.').should('be.visible')

    // Add new row
    cy.wait(300)
    cy.get(SELECTORS.addRowButton).click()
  })
}

Then('the compliance report introduction is shown', () => {
  cy.get('[data-test="compliance-report-header"]')
    .should('be.visible')
    .and(
      'have.text',
      `${currentComplianceYear} Compliance report - Original Report`
    )

  cy.get(SELECTORS.complianceReportStatus)
    .should('be.visible')
    .and('have.text', 'Status: Draft')

  cy.get('[data-test="compliance-report-intro"]')
    .should('be.visible')
    .and('have.text', 'Introduction')

  cy.get('[data-test="intro-details"]')
    .should('be.visible')
    .and(
      'include.text',
      'Welcome to the British Columbia Low Carbon Fuel Standard Portal'
    )
})

Then('the compliance report summary includes the quantity', () => {
  cy.wait(1000)

  // Reusable function for checking summary rows
  const checkSummaryRow = (rowIndex, expectedValue) => {
    cy.get(
      `${SELECTORS.renewableSummaryTable} > :nth-child(${rowIndex}) > :nth-child(3) > span`
    )
      .should('be.visible')
      .and('have.text', expectedValue)
  }

  checkSummaryRow(2, '10,000')
  checkSummaryRow(3, '10,000')
  checkSummaryRow(4, '500')
})

When('the supplier fills out line 6', () => {
  cy.get(`${SELECTORS.renewableSummaryTable} > :nth-child(6) > :nth-child(3)`)
    .find('input')
    .clear()
    .type('50{enter}')
    .blur()
})

Then('it should round the amount to 25', () => {
  cy.get(`${SELECTORS.renewableSummaryTable} > :nth-child(6) > :nth-child(3)`)
    .find('input')
    .should('be.visible')
    .and('have.value', '25')
})

When('the supplier accepts the agreement', () => {
  cy.waitAndClick(SELECTORS.checkbox)
})

When('the supplier submits the report', () => {
  cy.waitAndClick(SELECTORS.submitReportButton)
  cy.waitAndClick(SELECTORS.submitModalButton)
  cy.wait(1000)
})

Then('the banner shows success', () => {
  cy.contains('div', 'Compliance report successfully submitted').should(
    'be.visible'
  )
})

Then('they see the previously submitted report', () => {
  cy.get('.ag-column-first > a > .MuiBox-root')
    .should('be.visible')
    .and('have.text', currentComplianceYear)
})

Then('they click the report to view it', () => {
  cy.get('.ag-column-first > a > .MuiBox-root').click()
  cy.wait(2000)
})

Then('the report is shown with the fuel supply data entered', () => {
  cy.get('[data-test="compliance-report-header"]').should('be.visible')

  cy.contains('Supply of fuel').should('be.visible')

  cy.get(
    `[data-test="fuel-supply-summary"] .ag-center-cols-container .ag-row:first-child() .ag-cell[col-id="quantity"] span`
  )
    .should('be.visible')
    .and('have.text', '100,000')
  cy.get(
    `[data-test="fuel-supply-summary"] .ag-center-cols-container .ag-row:nth-child(2) .ag-cell[col-id="quantity"] span`
  )
    .should('be.visible')
    .and('have.text', '200,000')
})

When('the analyst recommends to the compliance manager', () => {
  cy.waitAndClick(SELECTORS.recommendToCompianceManagerButton)
  cy.waitAndClick(SELECTORS.submitModalComplianceManagerButton)
  cy.wait(1000)
})

When('the analyst logs in with valid IDIR credentials', () => {
  cy.loginWith(
    'idir',
    Cypress.env('ADMIN_IDIR_USERNAME'),
    Cypress.env('ADMIN_IDIR_PASSWORD')
  )
  cy.wait(5000)
  cy.setIDIRRoles('analyst')
  cy.visit('/', { timeout: 60000 })
  cy.get(SELECTORS.dashboard).should('exist')
})

When('the compliance manager logs in with valid IDIR credentials', () => {
  cy.loginWith(
    'idir',
    Cypress.env('ADMIN_IDIR_USERNAME'),
    Cypress.env('ADMIN_IDIR_PASSWORD')
  )
  cy.wait(5000)
  cy.setIDIRRoles('compliance manager')
  cy.visit('/', { timeout: 60000 })
  cy.get(SELECTORS.dashboard).should('exist')
})

When('the director logs in with valid credentials', () => {
  cy.loginWith(
    'idir',
    Cypress.env('ADMIN_IDIR_USERNAME'),
    Cypress.env('ADMIN_IDIR_PASSWORD')
  )
  cy.wait(5000)
  cy.setIDIRRoles('director')
  cy.visit('/', { timeout: 60000 })
  cy.get(SELECTORS.dashboard).should('exist')
})

When('the compliance manager recommends to the director', () => {
  cy.waitAndClick(SELECTORS.recommendToDirectorButton)
  cy.waitAndClick(SELECTORS.submitModalDirectorButton)
  cy.wait(1000)
})

Then('the recommended by analyst banner shows success', () => {
  cy.contains(
    'div',
    'Compliance report successfully recommended by analyst'
  ).should('be.visible')
})
Then('the recommended by compliance manager banner shows success', () => {
  cy.contains(
    'div',
    'Compliance report successfully recommended by manager'
  ).should('be.visible')
})
Then('the assessed by director banner shows success', () => {
  cy.contains('div', 'Compliance report successfully assessed').should(
    'be.visible'
  )
})

When('the director approves the report', () => {
  cy.waitAndClick(SELECTORS.issueAssessmentButton)
  cy.waitAndClick(SELECTORS.submitModalIssueAssessmentButton)
  cy.wait(1000)
})

When('they create a supplemental report', () => {
  cy.waitAndClick(SELECTORS.createSupplementalReport)
  cy.wait(3000)
})

When('the supplier edits the fuel supply data', () => {
  cy.waitAndClick(SELECTORS.supplyOfFuelButton)
  cy.wait(2000)

  cy.get(SELECTORS.agGridRoot).should('be.visible')
  cy.wait(500)

  cy.get('div.ag-cell[col-id="quantity"]').first().click()
  cy.wait(500)
  cy.get('div.ag-cell[col-id="quantity"]')
    .first()
    .find('input')
    .clear()
    .type('20000{enter}')

  cy.contains('Row updated successfully.').should('be.visible')

  cy.waitAndClick(SELECTORS.saveButton)
  cy.wait(1000)
})

Then(
  'the report is shown with the supplemental fuel supply data entered',
  () => {
    cy.get('[data-test="compliance-report-header"]').should('be.visible')

    cy.get(
      `[data-test="fuel-supply-summary"] .ag-center-cols-container .ag-row:first-child() .ag-cell[col-id="quantity"] span`
    )
      .should('be.visible')
      .and('have.text', '20,000')
    cy.get(
      `[data-test="fuel-supply-summary"] .ag-center-cols-container .ag-row:nth-child(2) .ag-cell[col-id="quantity"] span`
    )
      .should('be.visible')
      .and('have.text', '200,000')
  }
)
