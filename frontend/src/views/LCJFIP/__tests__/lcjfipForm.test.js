import { describe, expect, it } from 'vite-plus/test'
import {
  buildSchema,
  defaultFormValues,
  emptyPurchaseRow,
  estimatedIncentiveAmount,
  formatIncentiveAmount,
  formValuesFromApplication,
  pricePremiumProblem,
  selectMaxRate,
  toPayload,
  totalEstimatedVolume
} from '../lcjfipForm'

const RATES = [
  {
    incentiveType: 'Cash',
    ciLowerBound: 10,
    ciUpperBound: null,
    maxRatePerLitre: 0.75
  },
  {
    incentiveType: 'Cash',
    ciLowerBound: null,
    ciUpperBound: 10,
    maxRatePerLitre: 1.125
  },
  {
    incentiveType: 'Credit',
    ciLowerBound: 10,
    ciUpperBound: null,
    maxRatePerLitre: 0.005
  },
  {
    incentiveType: 'Credit',
    ciLowerBound: null,
    ciUpperBound: 10,
    maxRatePerLitre: 0.0075
  }
]

// Messages come back as their keys, so assertions name the rule that fired.
const schema = buildSchema((key) => key)
const TRANSFER_OPTION = 3
const context = (submit) => ({
  submit,
  supplierOptionIds: [TRANSFER_OPTION],
  maxPremiumRange: 0.25
})

const validationErrors = async (values, submit) => {
  try {
    await schema.validate(values, {
      abortEarly: false,
      context: context(submit)
    })
    return {}
  } catch (error) {
    return Object.fromEntries(error.inner.map((e) => [e.path, e.message]))
  }
}

const completeRow = (overrides = {}) => ({
  ...emptyPurchaseRow(),
  estimatedVolume: 600000,
  anticipatedDeliveryDate: '2027-03-31',
  feedstockSourceIds: [1],
  estimatedBlendPercentage: 30,
  assumedJetAPrice: 0.9,
  pricePremiumFrom: 1.5,
  pricePremiumTo: 1.7,
  ...overrides
})

const completeForm = (overrides = {}) => ({
  ...defaultFormValues(),
  incentiveOptionId: 1,
  requestedIncentiveVolume: 600000,
  purchaseDetails: [completeRow()],
  declarations: {
    authority: true,
    documentation: true,
    publicRecognition: true
  },
  ...overrides
})

describe('LCJFIP calculations', () => {
  it('totals the purchase volumes and ignores empty rows', () => {
    expect(
      totalEstimatedVolume([
        { estimatedVolume: 600000 },
        { estimatedVolume: null },
        { estimatedVolume: 400000 }
      ])
    ).toBe(1000000)
    expect(totalEstimatedVolume([{ estimatedVolume: null }])).toBeNull()
  })

  it.each([
    ['Cash', -5, 1.125],
    ['Cash', 10, 1.125],
    ['Cash', 10.01, 0.75],
    ['Credit', 10, 0.0075],
    ['Credit', 25, 0.005]
  ])(
    'gives the %s rate for CI %s (upper bound inclusive)',
    (type, ci, rate) => {
      expect(selectMaxRate(RATES, type, ci)).toBe(rate)
    }
  )

  it('uses the baseline (lowest) rate without a carbon intensity', () => {
    expect(selectMaxRate(RATES, 'Cash', null)).toBe(0.75)
    expect(selectMaxRate(RATES, 'Credit', undefined)).toBe(0.005)
  })

  it('has no rate until an option is chosen', () => {
    expect(selectMaxRate(RATES, null, 8)).toBeNull()
  })

  it('multiplies the requested volume by the rate, to the cent', () => {
    expect(estimatedIncentiveAmount(1000000, 1.125)).toBe(1125000)
    expect(estimatedIncentiveAmount(333, 0.0075)).toBe(2.5)
    expect(estimatedIncentiveAmount(null, 1.125)).toBeNull()
  })

  it('formats cash in CAD and credits as credits', () => {
    const credits = (amount) => `${amount} credits`
    expect(formatIncentiveAmount(1125000, 'Cash', credits)).toBe(
      '$1,125,000 CAD'
    )
    // Cents only when there are any.
    expect(formatIncentiveAmount(1234.5, 'Cash', credits)).toBe('$1,234.50 CAD')
    expect(formatIncentiveAmount(7500, 'Credit', credits)).toBe(
      '7,500.00 credits'
    )
    expect(formatIncentiveAmount(null, 'Cash', credits)).toBe('')
  })

  it.each([
    [1.5, 1.75, null],
    [0.65, 0.9, null],
    [1.5, 1.76, 'range'],
    [1.8, 1.6, 'order'],
    [1.5, null, null]
  ])('checks a premium range of %s to %s', (from, to, problem) => {
    expect(pricePremiumProblem(from, to, 0.25)).toBe(problem)
  })
})

describe('LCJFIP form mapping', () => {
  it('sends a linked supplier without a typed legal name', () => {
    const payload = toPayload(
      completeForm({
        carTypeId: 4,
        fuelSupplierOrganizationId: 9,
        fuelSupplierLegalName: 'Registered supplier',
        fuelSupplierContactEmail: '  '
      })
    )
    expect(payload.carTypeIds).toEqual([4])
    expect(payload.fuelSupplierOrganizationId).toBe(9)
    expect(payload.fuelSupplierLegalName).toBeNull()
    expect(payload.fuelSupplierContactEmail).toBeNull()
    expect(payload).not.toHaveProperty('declarations')
  })

  it('restores a saved application, showing a linked supplier by name', () => {
    const values = formValuesFromApplication({
      carTypeIds: [2],
      certificateTypeId: null,
      incentiveOptionId: 3,
      estimatedCarbonIntensity: 8.5,
      fuelCode: { fuelCodeId: 5, fuelCode: 'C101.0', carbonIntensity: 8.5 },
      requestedIncentiveVolume: 100,
      fuelSupplierOrganization: {
        organizationId: 9,
        name: 'Registered supplier'
      },
      fuelSupplierLegalName: null,
      fuelSupplierContactFirstName: null,
      fuelSupplierContactLastName: null,
      fuelSupplierContactEmail: null,
      purchaseDetails: [{ ...completeRow(), lcjfipPurchaseDetailId: 11 }]
    })
    expect(values.carTypeId).toBe(2)
    expect(values.certificateTypeId).toBe('')
    expect(values.fuelCodeId).toBe(5)
    expect(values.fuelSupplierLegalName).toBe('Registered supplier')
    expect(values.purchaseDetails[0].lcjfipPurchaseDetailId).toBe(11)
    expect(values.declarations.authority).toBe(false)
  })
})

describe('LCJFIP form validation', () => {
  it('saves an empty draft', async () => {
    expect(await validationErrors(defaultFormValues(), false)).toEqual({})
  })

  it('still checks formats and ranges on a draft save', async () => {
    const errors = await validationErrors(
      {
        ...defaultFormValues(),
        fuelSupplierContactEmail: 'not-an-email',
        purchaseDetails: [
          {
            ...emptyPurchaseRow(),
            estimatedBlendPercentage: 120,
            pricePremiumFrom: 1.8,
            pricePremiumTo: 1.6
          }
        ]
      },
      false
    )
    expect(errors).toEqual({
      fuelSupplierContactEmail: 'lcjfip:validation.email',
      'purchaseDetails[0].estimatedBlendPercentage':
        'lcjfip:validation.blendRange',
      'purchaseDetails[0].pricePremiumTo': 'lcjfip:validation.premiumOrder'
    })
  })

  it('does not check the premium width until submission', async () => {
    const values = completeForm({
      purchaseDetails: [completeRow({ pricePremiumTo: 1.8 })]
    })
    expect(await validationErrors(values, false)).toEqual({})
    expect(await validationErrors(values, true)).toEqual({
      'purchaseDetails[0].pricePremiumTo': 'lcjfip:validation.premiumRange'
    })
  })

  it('accepts a complete application on submission', async () => {
    expect(await validationErrors(completeForm(), true)).toEqual({})
  })

  it('requires every submission field', async () => {
    const errors = await validationErrors(
      { ...defaultFormValues(), purchaseDetails: [emptyPurchaseRow()] },
      true
    )
    expect(Object.keys(errors).sort()).toEqual([
      'declarations',
      'incentiveOptionId',
      'purchaseDetails[0].anticipatedDeliveryDate',
      'purchaseDetails[0].assumedJetAPrice',
      'purchaseDetails[0].estimatedVolume',
      'purchaseDetails[0].pricePremiumFrom',
      'purchaseDetails[0].pricePremiumTo',
      'requestedIncentiveVolume'
    ])
  })

  it('requires at least one purchase row on submission', async () => {
    const errors = await validationErrors(
      completeForm({ purchaseDetails: [], requestedIncentiveVolume: 1 }),
      true
    )
    expect(errors.purchaseDetails).toBe('lcjfip:validation.purchaseRequired')
  })

  it('caps the requested volume at the purchase total', async () => {
    const errors = await validationErrors(
      completeForm({ requestedIncentiveVolume: 600001 }),
      true
    )
    expect(errors).toEqual({
      requestedIncentiveVolume: 'lcjfip:validation.requestedExceedsTotal'
    })
  })

  it('requires the fuel supplier only for the transfer option', async () => {
    expect(await validationErrors(completeForm(), true)).toEqual({})
    const errors = await validationErrors(
      completeForm({ incentiveOptionId: TRANSFER_OPTION }),
      true
    )
    expect(Object.keys(errors).sort()).toEqual([
      'fuelSupplierContactEmail',
      'fuelSupplierContactFirstName',
      'fuelSupplierContactLastName',
      'fuelSupplierLegalName'
    ])
  })

  it('accepts a linked supplier in place of a typed legal name', async () => {
    const errors = await validationErrors(
      completeForm({
        incentiveOptionId: TRANSFER_OPTION,
        fuelSupplierOrganizationId: 9,
        fuelSupplierContactFirstName: 'Test',
        fuelSupplierContactLastName: 'Contact',
        fuelSupplierContactEmail: 'contact@example.com'
      }),
      true
    )
    expect(errors).toEqual({})
  })
})
