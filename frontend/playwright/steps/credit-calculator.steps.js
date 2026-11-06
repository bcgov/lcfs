import { expect } from '@playwright/test'
import { Given, Then, When, getByDataTest } from '../support/fixtures.js'
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

Given('calculator API responses are stubbed', async ({ page }) => {
  await stubCalculatorApi(page)
})

When('I open the credit calculator', async ({ page }) => {
  await openCalculatorPage(page)
})

Then('the calculator page is public and accessible', async ({ page }) => {
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

Then(
  'the calculator description fits at zoom-equivalent widths',
  async ({ page }) => {
    await assertResponsiveDescription(page)
  }
)

When(
  'I choose a compliance year, fuel category, and fuel type',
  async ({ page }) => {
    await openCalculatorPage(page)
    await page.locator('#compliance-year').click()
    await page.locator('li[data-value="2025"]').click()
    await expect(page.locator('#compliance-year')).toContainText('2025')
    await expect(
      page.locator('input[type="radio"][value="Biodiesel"]')
    ).toHaveCount(0)
    await selectDieselBiodiesel(page, { clickFuelCategoryLabel: true })
  }
)

Then('the end use and provision are populated', async ({ page }) => {
  await expect(page.locator('input[type="radio"][value="Any"]')).toBeChecked()
  await expect(
    page.locator(
      'input[type="radio"][value="Default carbon intensity - section 19 (b) (ii)"]'
    )
  ).toBeChecked()
})

When(
  'I calculate compliance units from the default quantity',
  async ({ page }) => {
    await openCalculatorPage(page)
    const calculation = waitForCalculatorResponse(page)
    await selectDieselBiodiesel(page)
    await calculation
  }
)

Then('the quantity and compliance units are shown', async ({ page }) => {
  await expect(getByDataTest(page, 'quantity')).toHaveValue('100,000')
  await expect(getByDataTest(page, 'complianceUnits')).toHaveValue('1,234')
})

When('I reverse-calculate quantity from compliance units', async ({ page }) => {
  await openCalculatorPage(page)
  const calculation = waitForCalculatorResponse(page)
  await selectDieselBiodiesel(page)
  await calculation

  await expect(getByDataTest(page, 'complianceUnits')).toHaveValue('1,234')
  const reverseCalculation = waitForCalculatorResponse(page, 'quantity')
  await replaceNumericValue(getByDataTest(page, 'complianceUnits'), '500')
  await reverseCalculation
})

Then('the calculated quantity is shown', async ({ page }) => {
  await expect(getByDataTest(page, 'quantity')).toHaveValue('42,000')
})

When('I calculate with a custom carbon intensity', async ({ page }) => {
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
})

Then('the custom calculation result is shown', async ({ page }) => {
  await expect(getByDataTest(page, 'complianceUnits')).toHaveValue('999')
})

When('I open the calculation data page', async ({ page }) => {
  await openCalculationDataPage(page)
})

Then('the public reference data is displayed accessibly', async ({ page }) => {
  await expect(page).toHaveURL(/\/calculation-data$/)
  await expect(getByDataTest(page, 'login-container')).toHaveCount(0)
  await expect(
    page.getByRole('tab', { name: 'Calculation data' })
  ).toBeVisible()
  await assertDescription(page, calculationDataDescription, '.ag-root')
  await assertDescriptionAccessibility(page)
  await expect(page.locator('.ag-center-cols-container .ag-row')).toHaveCount(2)
  await expect(page.locator('.ag-cell', { hasText: 'Biodiesel' })).toBeVisible()
  await expect(page.locator('.ag-cell', { hasText: 'Ethanol' })).toBeVisible()
})

Then(
  'the calculation data description fits at zoom-equivalent widths',
  async ({ page }) => {
    await assertResponsiveDescription(page)
  }
)

Then(
  'the CI, TCI, EER, and energy density columns are visible',
  async ({ page }) => {
    await page.locator('.ag-center-cols-viewport').evaluate((element) => {
      element.scrollLeft = element.scrollWidth
    })
    for (const column of ['Target CI', 'CI of fuel', 'EER', 'Energy density']) {
      await expect(
        page.locator('.ag-header-cell-text', { hasText: column }).first()
      ).toBeVisible()
    }
  }
)
