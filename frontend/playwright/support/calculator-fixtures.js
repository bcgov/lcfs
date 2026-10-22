import { expect } from '@playwright/test'
import { getByDataTest } from './fixtures.js'
import { runAccessibilityAudit } from './accessibility.js'

export const compliancePeriodsFixture = [
  { description: '2030' },
  { description: '2026' },
  { description: '2025' },
  { description: '2024' },
  { description: '2023' }
]

export const fuelTypeListFixture = [
  { fuelType: 'Biodiesel', fuelTypeId: 2, fuelCategoryId: 1 }
]

export const fuelTypeOptionsFixture = {
  unit: 'L',
  energyDensity: { unit: { name: 'MJ/L' } },
  eerRatios: [{ endUseType: { type: 'Any', endUseTypeId: 1 } }],
  provisions: [{ name: 'Default carbon intensity - section 19 (b) (ii)' }],
  fuelCodes: []
}

export const calculateFixture = {
  complianceUnits: 1234,
  tci: 90.5,
  eer: 1.0,
  rci: 20.0,
  uci: 0,
  energyContent: 3700000,
  energyDensity: 37,
  quantity: 100000
}

export const quantityFixture = {
  quantity: 42000,
  complianceUnits: 500,
  tci: 90.5,
  eer: 1.0,
  rci: 20.0,
  uci: 0,
  energyContent: 1554000,
  energyDensity: 37
}

export const lookupTableFixture = {
  data: [
    {
      fuelType: 'Biodiesel',
      fuelCategory: 'Diesel',
      endUse: 'Any',
      determiningCarbonIntensity:
        'Default carbon intensity - section 19 (b) (ii)',
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
      determiningCarbonIntensity:
        'Default carbon intensity - section 19 (b) (ii)',
      targetCi: 88.83,
      ciOfFuel: 40.2,
      uci: 0,
      eer: 1.0,
      energyDensity: 23.58,
      energyDensityUnit: 'MJ/L'
    }
  ]
}

export const calculatorDescription = [
  'Use this calculator to estimate the compliance units that may be generated or required under the Low Carbon Fuel Standard (LCFS) in compliance reporting. By entering fuel and carbon intensity information, you can explore how different fuel supplies and scenarios may affect your compliance position.',
  'The calculator is provided as an informational tool to support planning. Results are estimates only and do not represent an official compliance assessment or compliance unit balance. Official compliance outcomes are determined through the reporting and assessment processes established under the Low Carbon Fuels Act and associated regulations.'
]

export const calculationDataDescription = [
  'Use this table to identify the inputs used in LCFS compliance unit calculations. Search or filter the table to find the values that apply to a specific fuel and reporting scenario and use them as a reference when completing a calculation in the Compliance Unit Calculator. The examples shown on this page are based on prescribed or default carbon intensity values. For your own calculations, use the applicable fuel code and the corresponding values.',
  'The example calculations generated from these inputs are for illustrative purposes only and do not represent an official compliance assessment or compliance unit balance. Official compliance outcomes are determined through reporting and assessment processes under the Low Carbon Fuels Act and associated regulations.'
]

const responseFixtures = {
  compliancePeriods: compliancePeriodsFixture,
  fuelTypes: fuelTypeListFixture,
  fuelTypeOptions: fuelTypeOptionsFixture,
  calculate: calculateFixture,
  calculateQuantity: quantityFixture,
  lookupTable: lookupTableFixture
}

export const stubCalculatorApi = async (page) => {
  await page.route(/\/calculator\//, async (route) => {
    const request = route.request()
    if (request.method() !== 'GET') return route.continue()

    const url = new URL(request.url())
    const { pathname } = url
    let fixtureName

    if (/\/calculator\/compliance-periods\/?$/.test(pathname)) {
      fixtureName = 'compliancePeriods'
    } else if (/\/calculator\/[^/]+\/fuel-type-options\/?$/.test(pathname)) {
      fixtureName = 'fuelTypeOptions'
    } else if (/\/calculator\/[^/]+\/calculate\/quantity\/?$/.test(pathname)) {
      fixtureName = 'calculateQuantity'
    } else if (/\/calculator\/[^/]+\/lookup-table\/?$/.test(pathname)) {
      fixtureName = 'lookupTable'
    } else if (/\/calculator\/[^/]+\/calculate\/?$/.test(pathname)) {
      fixtureName = 'calculate'
    } else if (/\/calculator\/[^/]+\/?$/.test(pathname)) {
      fixtureName = 'fuelTypes'
    } else {
      return route.continue()
    }

    let body = responseFixtures[fixtureName]
    if (
      fixtureName === 'calculate' &&
      url.searchParams.get('useCustomCi') === 'true'
    ) {
      body = { ...calculateFixture, complianceUnits: 999 }
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    })
  })
}

export const assertDescription = async (
  page,
  paragraphs,
  nextContentSelector
) => {
  const description = getByDataTest(page, 'public-calculator-description')
  await expect(description).toBeVisible()
  const renderedParagraphs = description.locator('p')
  await expect(renderedParagraphs).toHaveCount(2)
  for (const [index, paragraph] of paragraphs.entries()) {
    await expect(renderedParagraphs.nth(index)).toContainText(paragraph)
  }

  const followsNextContent = await description.evaluate((element, selector) => {
    const nextContent = element.ownerDocument.querySelector(selector)
    return Boolean(
      nextContent &&
        element.compareDocumentPosition(nextContent) &
          Node.DOCUMENT_POSITION_FOLLOWING
    )
  }, nextContentSelector)
  expect(followsNextContent).toBe(true)
}

export const assertDescriptionAccessibility = async (page) => {
  const { violations } = await runAccessibilityAudit(
    page,
    {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
      }
    },
    '[data-test="public-calculator-description"]'
  )
  expect(violations).toEqual([])
}

export const assertResponsiveDescription = async (page) => {
  const description = getByDataTest(page, 'public-calculator-description')
  for (const width of [640, 320]) {
    await page.setViewportSize({ width, height: 800 })
    await expect(description).toBeVisible()
    const fits = await description.evaluate(
      (element) => element.scrollWidth <= element.clientWidth
    )
    expect(fits).toBe(true)
  }
}

export const selectDieselBiodiesel = async (
  page,
  { clickFuelCategoryLabel = false } = {}
) => {
  const fuelTypes = waitForCalculatorResponse(page, 'fuelTypes')
  if (clickFuelCategoryLabel) {
    await page.getByText('Diesel', { exact: true }).click()
  } else {
    await page
      .locator('input[type="radio"][value="Diesel"]')
      .check({ force: true })
  }
  await expect(
    page.locator('input[type="radio"][value="Diesel"]')
  ).toBeChecked()
  await fuelTypes

  const fuelTypeOptions = waitForCalculatorResponse(page, 'fuelTypeOptions')
  await page
    .locator('input[type="radio"][value="Biodiesel"]')
    .check({ force: true })
  await expect(
    page.locator('input[type="radio"][value="Biodiesel"]')
  ).toBeChecked()
  await fuelTypeOptions
  await expect(page.locator('input[type="radio"][value="Any"]')).toBeChecked()
  await expect(
    page.locator(
      'input[type="radio"][value="Default carbon intensity - section 19 (b) (ii)"]'
    )
  ).toBeChecked()
  // Supply the quantity explicitly instead of relying on a default-value calculation.
  if (!clickFuelCategoryLabel) {
    await replaceNumericValue(getByDataTest(page, 'quantity'), '100000')
  }
}

export const replaceNumericValue = async (input, value) => {
  // NumericFormat handles focus/keyboard events; atomic fill can race its caret updates.
  await input.click()
  await input.press('ControlOrMeta+A')
  await input.press('Backspace')
  await expect(input).toHaveValue('')
  await input.pressSequentially(value, { delay: 0 })
  await input.blur()
}

export const calculatorResponseMatches = (response, kind) => {
  const request = response.request()
  if (request.method() !== 'GET') return false

  const url = new URL(response.url())
  if (kind === 'compliancePeriods') {
    return /\/calculator\/compliance-periods\/?$/.test(url.pathname)
  }
  if (kind === 'lookupTable') {
    return /\/calculator\/[^/]+\/lookup-table\/?$/.test(url.pathname)
  }
  if (kind === 'fuelTypes') {
    return /\/calculator\/[^/]+\/?$/.test(url.pathname)
  }
  if (kind === 'fuelTypeOptions') {
    return /\/calculator\/[^/]+\/fuel-type-options\/?$/.test(url.pathname)
  }
  if (kind === 'quantity') {
    return /\/calculator\/[^/]+\/calculate\/quantity\/?$/.test(url.pathname)
  }
  if (kind === 'custom') {
    return (
      /\/calculator\/[^/]+\/calculate\/?$/.test(url.pathname) &&
      url.searchParams.get('useCustomCi') === 'true' &&
      Number(url.searchParams.get('customCiValue')) === 85.5
    )
  }
  return (
    /\/calculator\/[^/]+\/calculate\/?$/.test(url.pathname) &&
    url.searchParams.get('useCustomCi') !== 'true'
  )
}

export const waitForCalculatorResponse = (page, kind = 'forward') =>
  page.waitForResponse((response) => calculatorResponseMatches(response, kind))

export const openCalculatorPage = async (page) => {
  const compliancePeriods = waitForCalculatorResponse(page, 'compliancePeriods')
  await page.goto('/credit-calculator')
  await compliancePeriods
}

export const openCalculationDataPage = async (page) => {
  const lookupTable = waitForCalculatorResponse(page, 'lookupTable')
  await page.goto('/calculation-data')
  await lookupTable
}
