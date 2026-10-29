import { expect } from '@playwright/test'
import { getByDataTest, test } from '../support/fixtures.js'
import {
  assertDescription,
  assertDescriptionAccessibility,
  assertResponsiveDescription,
  calculatorDescription,
  calculationDataDescription,
  openCalculatorPage,
  openCalculationDataPage,
  replaceNumericValue,
  selectDieselBiodiesel,
  stubCalculatorApi,
  waitForCalculatorResponse
} from '../support/calculator-fixtures.js'

test.describe('Public Credit Calculator and Calculation Data (#4089)', () => {
  test.beforeEach(async ({ page }) => {
    await stubCalculatorApi(page)
  })

  test('calculator loads without authentication', async ({ page }) => {
    await openCalculatorPage(page)

    await expect(page).toHaveURL(/\/credit-calculator$/)
    await expect(getByDataTest(page, 'login-container')).toHaveCount(0)
    await expect(
      page.getByRole('tab', { name: 'Compliance unit calculator' })
    ).toBeVisible()
    await assertDescription(page, calculatorDescription, '#compliance-year')
    await assertDescriptionAccessibility(page)
    await expect(page.locator('#compliance-year')).toBeVisible()
    await expect(getByDataTest(page, 'quantity')).toBeVisible()
  })

  test('calculator description reflows at 200% and 400% zoom-equivalent widths', async ({
    page
  }) => {
    await openCalculatorPage(page)
    await assertResponsiveDescription(page)
  })

  test('cascades compliance year, fuel category, fuel type, end use, and provision', async ({
    page
  }) => {
    await openCalculatorPage(page)

    await page.locator('#compliance-year').click()
    await page.locator('li[data-value="2025"]').click()
    await expect(page.locator('#compliance-year')).toContainText('2025')
    await expect(
      page.locator('input[type="radio"][value="Biodiesel"]')
    ).toHaveCount(0)

    await selectDieselBiodiesel(page, { clickFuelCategoryLabel: true })
    await expect(page.locator('input[type="radio"][value="Any"]')).toBeChecked()
    await expect(
      page.locator(
        'input[type="radio"][value="Default carbon intensity - section 19 (b) (ii)"]'
      )
    ).toBeChecked()
  })

  test('calculates compliance units from a supplied quantity', async ({
    page
  }) => {
    await openCalculatorPage(page)
    const calculation = waitForCalculatorResponse(page)
    await selectDieselBiodiesel(page)
    await calculation

    await expect(getByDataTest(page, 'quantity')).toHaveValue('100,000')
    await expect(getByDataTest(page, 'complianceUnits')).toHaveValue('1,234')
  })

  test('reverse-calculates quantity from compliance units', async ({
    page
  }) => {
    await openCalculatorPage(page)
    const calculation = waitForCalculatorResponse(page)
    await selectDieselBiodiesel(page)
    await calculation

    await expect(getByDataTest(page, 'complianceUnits')).toHaveValue('1,234')
    const reverseCalculation = waitForCalculatorResponse(page, 'quantity')
    const units = getByDataTest(page, 'complianceUnits')
    await replaceNumericValue(units, '500')
    await reverseCalculation
    await expect(getByDataTest(page, 'quantity')).toHaveValue('42,000')
  })

  test('accepts a custom carbon intensity for applicable provisions', async ({
    page
  }) => {
    await openCalculatorPage(page)
    const initialCalculation = waitForCalculatorResponse(page)
    await selectDieselBiodiesel(page)
    await initialCalculation
    await expect(getByDataTest(page, 'complianceUnits')).toHaveValue('1,234')

    await page
      .locator('input[type="radio"][value="customCi"]')
      .check({ force: true })
    const carbonIntensity = page.locator('#carbon-intensity-input')
    await expect(carbonIntensity).toBeEnabled()

    const customCalculation = waitForCalculatorResponse(page, 'custom')
    await replaceNumericValue(carbonIntensity, '85.50')
    await customCalculation
    await expect(getByDataTest(page, 'complianceUnits')).toHaveValue('999')
  })

  test('calculation data loads publicly with reference data', async ({
    page
  }) => {
    await openCalculationDataPage(page)

    await expect(page).toHaveURL(/\/calculation-data$/)
    await expect(getByDataTest(page, 'login-container')).toHaveCount(0)
    await expect(
      page.getByRole('tab', { name: 'Calculation data' })
    ).toBeVisible()
    await assertDescription(page, calculationDataDescription, '.ag-root')
    await assertDescriptionAccessibility(page)
    await expect(page.locator('.ag-center-cols-container .ag-row')).toHaveCount(
      2
    )
    await expect(
      page.locator('.ag-cell', { hasText: 'Biodiesel' })
    ).toBeVisible()
    await expect(page.locator('.ag-cell', { hasText: 'Ethanol' })).toBeVisible()
  })

  test('calculation data description reflows at 200% and 400% zoom-equivalent widths', async ({
    page
  }) => {
    await openCalculationDataPage(page)
    await assertResponsiveDescription(page)
  })

  test('displays the reference columns for CI, TCI, EER, and energy density', async ({
    page
  }) => {
    await openCalculationDataPage(page)
    await page.locator('.ag-center-cols-viewport').evaluate((element) => {
      element.scrollLeft = element.scrollWidth
    })

    for (const column of ['Target CI', 'CI of fuel', 'EER', 'Energy density']) {
      await expect(
        page.locator('.ag-header-cell-text', { hasText: column }).first()
      ).toBeVisible()
    }
  })
})
