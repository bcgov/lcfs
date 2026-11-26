import * as Yup from 'yup'
import type { TFunction } from 'i18next'
import { isValid, parseISO } from 'date-fns'
import type {
  LCJFIPApplication,
  LCJFIPApplicationPayload,
  LCJFIPDeclarations,
  LCJFIPIncentiveRate
} from '@/hooks/useLCJFIP'

// Form shape, API mapping, calculation rules and validation for the LCJFIP
// application form (#5532). The calculations mirror the backend's
// (lcfs/web/api/lcjfip/calculations.py); the backend's values are stored.

export type PurchaseRowValues = {
  lcjfipPurchaseDetailId: number | null
  estimatedVolume: number | null
  anticipatedDeliveryDate: string | null
  feedstockSourceIds: number[]
  estimatedBlendPercentage: number | null
  assumedJetAPrice: number | null
  pricePremiumFrom: number | null
  pricePremiumTo: number | null
}

export type DeclarationValues = {
  authority: boolean
  documentation: boolean
  publicRecognition: boolean
}

export type LCJFIPFormValues = {
  // The form offers one CAR type; the API stores a list.
  carTypeId: number | ''
  certificateTypeId: number | ''
  incentiveOptionId: number | null
  estimatedCarbonIntensity: number | null
  fuelCodeId: number | null
  requestedIncentiveVolume: number | null
  fuelSupplierOrganizationId: number | null
  fuelSupplierLegalName: string
  fuelSupplierContactFirstName: string
  fuelSupplierContactLastName: string
  fuelSupplierContactEmail: string
  purchaseDetails: PurchaseRowValues[]
  declarations: DeclarationValues
}

export type ValidationContext = {
  // Draft saves check formats only; submission also checks completeness.
  submit: boolean
  // Incentive options that need the fuel supplier fields.
  supplierOptionIds: number[]
  maxPremiumRange: number
}

export const DEFAULT_MAX_PREMIUM_RANGE = 0.25

export const emptyPurchaseRow = (): PurchaseRowValues => ({
  lcjfipPurchaseDetailId: null,
  estimatedVolume: null,
  anticipatedDeliveryDate: null,
  feedstockSourceIds: [],
  estimatedBlendPercentage: null,
  assumedJetAPrice: null,
  pricePremiumFrom: null,
  pricePremiumTo: null
})

const noDeclarations = (): DeclarationValues => ({
  authority: false,
  documentation: false,
  publicRecognition: false
})

export const defaultFormValues = (): LCJFIPFormValues => ({
  carTypeId: '',
  certificateTypeId: '',
  incentiveOptionId: null,
  estimatedCarbonIntensity: null,
  fuelCodeId: null,
  requestedIncentiveVolume: null,
  fuelSupplierOrganizationId: null,
  fuelSupplierLegalName: '',
  fuelSupplierContactFirstName: '',
  fuelSupplierContactLastName: '',
  fuelSupplierContactEmail: '',
  purchaseDetails: [emptyPurchaseRow()],
  declarations: noDeclarations()
})

export const formValuesFromApplication = (
  application: LCJFIPApplication
): LCJFIPFormValues => ({
  carTypeId: application.carTypeIds[0] ?? '',
  certificateTypeId: application.certificateTypeId ?? '',
  incentiveOptionId: application.incentiveOptionId,
  estimatedCarbonIntensity: application.estimatedCarbonIntensity,
  fuelCodeId: application.fuelCode?.fuelCodeId ?? null,
  requestedIncentiveVolume: application.requestedIncentiveVolume,
  fuelSupplierOrganizationId:
    application.fuelSupplierOrganization?.organizationId ?? null,
  fuelSupplierLegalName:
    application.fuelSupplierOrganization?.name ??
    application.fuelSupplierLegalName ??
    '',
  fuelSupplierContactFirstName: application.fuelSupplierContactFirstName ?? '',
  fuelSupplierContactLastName: application.fuelSupplierContactLastName ?? '',
  fuelSupplierContactEmail: application.fuelSupplierContactEmail ?? '',
  // The form edits one purchase (the mock-up has one set of fields), so an
  // application saved without any gets an empty one.
  purchaseDetails: (application.purchaseDetails.length
    ? application.purchaseDetails
    : [emptyPurchaseRow()]
  ).map((row) => ({
    lcjfipPurchaseDetailId: row.lcjfipPurchaseDetailId,
    estimatedVolume: row.estimatedVolume,
    anticipatedDeliveryDate: row.anticipatedDeliveryDate,
    feedstockSourceIds: row.feedstockSourceIds,
    estimatedBlendPercentage: row.estimatedBlendPercentage,
    assumedJetAPrice: row.assumedJetAPrice,
    pricePremiumFrom: row.pricePremiumFrom,
    pricePremiumTo: row.pricePremiumTo
  })),
  declarations: noDeclarations()
})

// Validation turns an empty text field into null, so accept either.
const textOrNull = (value: string | null | undefined) => value?.trim() || null

export const toPayload = (
  values: LCJFIPFormValues
): LCJFIPApplicationPayload => ({
  carTypeIds: values.carTypeId === '' ? [] : [values.carTypeId],
  certificateTypeId:
    values.certificateTypeId === '' ? null : values.certificateTypeId,
  incentiveOptionId: values.incentiveOptionId,
  estimatedCarbonIntensity: values.estimatedCarbonIntensity,
  fuelCodeId: values.fuelCodeId,
  requestedIncentiveVolume: values.requestedIncentiveVolume,
  fuelSupplierOrganizationId: values.fuelSupplierOrganizationId,
  // A linked organization carries the legal name.
  fuelSupplierLegalName: values.fuelSupplierOrganizationId
    ? null
    : textOrNull(values.fuelSupplierLegalName),
  fuelSupplierContactFirstName: textOrNull(values.fuelSupplierContactFirstName),
  fuelSupplierContactLastName: textOrNull(values.fuelSupplierContactLastName),
  fuelSupplierContactEmail: textOrNull(values.fuelSupplierContactEmail),
  purchaseDetails: values.purchaseDetails.map((row) => ({ ...row }))
})

export const toDeclarations = (
  values: DeclarationValues
): LCJFIPDeclarations => ({
  declarationAuthority: values.authority,
  declarationDocumentation: values.documentation,
  declarationPublicRecognition: values.publicRecognition
})

// Server error fields are form paths, except the CAR type list.
export const formFieldFromServerField = (field: string) =>
  field === 'carTypeIds' ? 'carTypeId' : field

// ---------------------------------------------------------------------------
// Calculations
// ---------------------------------------------------------------------------

export const totalEstimatedVolume = (
  rows: Pick<PurchaseRowValues, 'estimatedVolume'>[] | undefined
): number | null => {
  const volumes = (rows ?? [])
    .map((row) => row.estimatedVolume)
    .filter((volume): volume is number => typeof volume === 'number')
  return volumes.length
    ? volumes.reduce((sum, volume) => sum + volume, 0)
    : null
}

/**
 * Maximum incentive per litre for an incentive type and carbon intensity.
 * Bands are lower-exclusive and upper-inclusive. Without a CI, the lowest
 * rate for the type applies (the "CI greater than 10" baseline).
 */
export const selectMaxRate = (
  rates: LCJFIPIncentiveRate[],
  incentiveType: string | null | undefined,
  carbonIntensity: number | null | undefined
): number | null => {
  if (!incentiveType) return null
  const applicable = rates.filter(
    (rate) => rate.incentiveType === incentiveType
  )
  if (!applicable.length) return null
  if (carbonIntensity === null || carbonIntensity === undefined) {
    return Math.min(...applicable.map((rate) => rate.maxRatePerLitre))
  }
  const match = applicable.find(
    (rate) =>
      (rate.ciLowerBound === null || carbonIntensity > rate.ciLowerBound) &&
      (rate.ciUpperBound === null || carbonIntensity <= rate.ciUpperBound)
  )
  return match ? match.maxRatePerLitre : null
}

export const estimatedIncentiveAmount = (
  requestedVolume: number | null | undefined,
  maxRate: number | null
): number | null => {
  if (requestedVolume === null || requestedVolume === undefined) return null
  if (maxRate === null) return null
  return Math.round((requestedVolume * maxRate + Number.EPSILON) * 100) / 100
}

/**
 * Cash amounts as "$625,000 CAD" (cents only when there are any); credit
 * amounts as "N credits". The labels add the unit in the user's language.
 */
export const formatIncentiveAmount = (
  amount: number | null,
  incentiveType: string | null | undefined,
  creditsLabel: (amount: string) => string,
  cashLabel: (amount: string) => string = (value) => `${value} CAD`
) => {
  if (amount === null || !incentiveType) return ''
  if (incentiveType === 'Cash') {
    const cents = Number.isInteger(amount) ? 0 : 2
    return cashLabel(
      amount.toLocaleString('en-CA', {
        style: 'currency',
        currency: 'CAD',
        minimumFractionDigits: cents,
        maximumFractionDigits: cents
      })
    )
  }
  return creditsLabel(
    amount.toLocaleString('en-CA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  )
}

/** 'order' when From exceeds To, 'range' when the range is too wide. */
export const pricePremiumProblem = (
  from: number | null | undefined,
  to: number | null | undefined,
  maxRange: number = DEFAULT_MAX_PREMIUM_RANGE
): 'order' | 'range' | null => {
  if (from === null || from === undefined || to === null || to === undefined) {
    return null
  }
  if (from > to) return 'order'
  // Prices carry at most four decimals; compare in ten-thousandths so that
  // binary floating point cannot push an exact $0.25 range over the limit.
  if (Math.round((to - from) * 10000) > Math.round(maxRange * 10000)) {
    return 'range'
  }
  return null
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const getContext = (testContext: Yup.TestContext): ValidationContext =>
  (testContext.options.context as ValidationContext) ?? {
    submit: false,
    supplierOptionIds: [],
    maxPremiumRange: DEFAULT_MAX_PREMIUM_RANGE
  }

export const buildSchema = (t: TFunction) => {
  const message = (key: string) => t(`lcjfip:validation.${key}`)

  const optionalNumber = () =>
    Yup.number()
      .typeError(message('number'))
      .nullable()
      .transform((value, original) =>
        original === '' || original === null || Number.isNaN(value)
          ? null
          : value
      )

  const requiredOnSubmit = <S extends Yup.Schema>(schema: S) =>
    schema.when('$submit', {
      is: true,
      then: (s) => s.required(message('required'))
    }) as S

  const positiveOnSubmit = (
    schema: Yup.NumberSchema<number | null | undefined>
  ) =>
    schema.when('$submit', {
      is: true,
      then: (s) =>
        s.required(message('required')).moreThan(0, message('positive'))
    })

  const optionalText = (max: number) =>
    Yup.string()
      .max(max)
      .transform((value) => (value === '' ? null : value))
      .nullable()

  const supplierField = (schema: Yup.StringSchema<string | null | undefined>) =>
    schema.test('required-for-transfer', message('required'), function (value) {
      const { submit, supplierOptionIds } = getContext(this)
      if (
        !submit ||
        !supplierOptionIds.includes(this.parent.incentiveOptionId)
      ) {
        return true
      }
      return !!value?.trim()
    })

  const purchaseRow = Yup.object({
    lcjfipPurchaseDetailId: Yup.number().nullable(),
    estimatedVolume: positiveOnSubmit(
      optionalNumber().min(0, message('nonNegative'))
    ),
    anticipatedDeliveryDate: requiredOnSubmit(
      Yup.string()
        .nullable()
        .test(
          'date',
          message('date'),
          (value) =>
            !value ||
            (/^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value)))
        )
    ),
    feedstockSourceIds: Yup.array().of(Yup.number().required()),
    estimatedBlendPercentage: optionalNumber()
      .min(0, message('blendRange'))
      .max(100, message('blendRange')),
    assumedJetAPrice: requiredOnSubmit(
      optionalNumber().min(0, message('nonNegative'))
    ),
    pricePremiumFrom: requiredOnSubmit(
      optionalNumber().min(0, message('nonNegative'))
    ),
    pricePremiumTo: requiredOnSubmit(
      optionalNumber().min(0, message('nonNegative'))
    )
      .test('premium-order', message('premiumOrder'), function (to) {
        return pricePremiumProblem(this.parent.pricePremiumFrom, to) !== 'order'
      })
      .test('premium-range', message('premiumRange'), function (to) {
        const { submit, maxPremiumRange } = getContext(this)
        if (!submit) return true
        return (
          pricePremiumProblem(
            this.parent.pricePremiumFrom,
            to,
            maxPremiumRange
          ) !== 'range'
        )
      })
  })

  return Yup.object({
    carTypeId: Yup.mixed<number | ''>(),
    certificateTypeId: Yup.mixed<number | ''>(),
    incentiveOptionId: Yup.number()
      .nullable()
      .when('$submit', {
        is: true,
        then: (s) => s.required(message('incentiveOption'))
      }),
    estimatedCarbonIntensity: optionalNumber(),
    fuelCodeId: Yup.number().nullable(),
    requestedIncentiveVolume: positiveOnSubmit(
      optionalNumber().min(0, message('nonNegative'))
    ).test('within-total', message('requestedExceedsTotal'), function (value) {
      if (!getContext(this).submit) return true
      const total = totalEstimatedVolume(this.parent.purchaseDetails)
      return (
        value === null ||
        value === undefined ||
        total === null ||
        value <= total
      )
    }),
    fuelSupplierOrganizationId: Yup.number().nullable(),
    fuelSupplierLegalName: optionalText(500).test(
      'required-for-transfer',
      message('required'),
      function (value) {
        const { submit, supplierOptionIds } = getContext(this)
        if (
          !submit ||
          !supplierOptionIds.includes(this.parent.incentiveOptionId)
        ) {
          return true
        }
        return !!(this.parent.fuelSupplierOrganizationId || value?.trim())
      }
    ),
    fuelSupplierContactFirstName: supplierField(optionalText(100)),
    fuelSupplierContactLastName: supplierField(optionalText(100)),
    fuelSupplierContactEmail: supplierField(
      optionalText(255).email(message('email'))
    ),
    purchaseDetails: Yup.array()
      .of(purchaseRow)
      .when('$submit', {
        is: true,
        then: (s) => s.min(1, message('purchaseRequired'))
      }),
    declarations: Yup.object({
      authority: Yup.boolean(),
      documentation: Yup.boolean(),
      publicRecognition: Yup.boolean()
    }).test('all-selected', message('declarations'), function (value) {
      if (!getContext(this).submit) return true
      return !!(
        value?.authority &&
        value.documentation &&
        value.publicRecognition
      )
    })
  })
}
