import { DEFAULT_CI_FUEL_CODE, NEW_REGULATION_YEAR } from '@/constants/common'
import type { FuelCode, FuelType, OptionsData } from '@/types/schema'

export interface RenewableClaimFuelTypeOption extends Pick<
  FuelType,
  'fuelType' | 'fuelCodes'
> {
  renewable?: boolean
}

export type RenewableClaimOptions = Omit<OptionsData, 'fuelTypes'> & {
  fuelTypes: RenewableClaimFuelTypeOption[]
}

type FuelTypeValue = string | { fuelType?: string }
type FuelCategoryValue = string | { category?: string }
type FuelCodeValue = string | Pick<FuelCode, 'fuelCode'> | null | undefined

interface RenewableClaimRow {
  [key: string]: unknown
  fuelType?: FuelTypeValue
  fuelCategory?: FuelCategoryValue
  fuelCode?: FuelCodeValue
  provisionOfTheAct?: string | { name?: string }
}

export interface RenewableClaimColumnVisibility {
  shouldShowIsCanadaProduced: boolean
  shouldShowIsQ1Supplied: boolean
}

const normalize = (value: string | null | undefined): string =>
  (value || '').toLowerCase()
const GASOLINE_ELIGIBLE_TYPES = new Set(
  ['Renewable gasoline', 'Ethanol', 'Renewable naphtha', 'Other'].map(normalize)
)
const DIESEL_ELIGIBLE_TYPES = new Set(
  ['Biodiesel', 'HDRD', 'Other diesel fuel', 'Other'].map(normalize)
)
const stripPrefix = (fuelCode?: string): string | undefined => {
  if (!fuelCode) return fuelCode
  return fuelCode.startsWith('C-') ? fuelCode.substring(2) : fuelCode
}
const getName = (value?: FuelTypeValue): string | undefined =>
  typeof value === 'string' ? value : value?.fuelType
const getCategory = (value?: FuelCategoryValue): string | undefined =>
  typeof value === 'string' ? value : value?.category
const getFuelCode = (value: FuelCodeValue): string | undefined =>
  typeof value === 'string' ? value : value?.fuelCode
const getProvisionName = (
  value: RenewableClaimRow['provisionOfTheAct']
): string | undefined => (typeof value === 'string' ? value : value?.name)
const findFuelTypeOption = (
  optionsData: RenewableClaimOptions | undefined,
  fuelTypeName?: string
): RenewableClaimFuelTypeOption | undefined =>
  optionsData?.fuelTypes?.find((item) => item.fuelType === fuelTypeName)
const findFuelCodeDetails = (
  fuelTypeOption: RenewableClaimFuelTypeOption | undefined,
  fuelCodeValue?: string
): FuelCode | null => {
  if (!fuelTypeOption?.fuelCodes?.length || !fuelCodeValue) {
    return null
  }
  const normalizedCode = stripPrefix(fuelCodeValue)
  return (
    fuelTypeOption.fuelCodes.find((fuelCode) => {
      const code = fuelCode.fuelCode || fuelCode.fuel_code
      return code === normalizedCode
    }) || null
  )
}

export const isEligibleRenewableFuel = (
  fuelTypeName: string | undefined,
  fuelCategory: string | undefined,
  optionsData: RenewableClaimOptions | undefined,
  complianceYear?: number
): boolean => {
  if (!fuelTypeName || !fuelCategory) {
    return false
  }
  const fuelTypeOption = findFuelTypeOption(optionsData, fuelTypeName)
  if (!fuelTypeOption?.renewable) {
    return false
  }
  const normalizedCategory = normalize(fuelCategory)
  const normalizedFuelType = normalize(fuelTypeName)
  if (
    normalizedCategory === 'gasoline' &&
    complianceYear &&
    complianceYear > NEW_REGULATION_YEAR
  ) {
    return GASOLINE_ELIGIBLE_TYPES.has(normalizedFuelType)
  }
  if (normalizedCategory === 'diesel') {
    return DIESEL_ELIGIBLE_TYPES.has(normalizedFuelType)
  }
  return false
}

export const isFuelCodeCanadian = (
  fuelTypeName: string | undefined,
  fuelCodeValue: FuelCodeValue,
  optionsData: RenewableClaimOptions | undefined
): boolean => {
  const fuelTypeOption = findFuelTypeOption(optionsData, fuelTypeName)
  if (!fuelTypeOption) {
    return false
  }
  const fuelCodeDetails = findFuelCodeDetails(
    fuelTypeOption,
    getFuelCode(fuelCodeValue)
  )
  if (!fuelCodeDetails?.fuelProductionFacilityCountry) {
    return false
  }
  return normalize(fuelCodeDetails.fuelProductionFacilityCountry) === 'canada'
}

export const getFuelCodeDetails = (
  fuelTypeName: string | undefined,
  fuelCodeValue: FuelCodeValue,
  optionsData: RenewableClaimOptions | undefined
): FuelCode | null => {
  const fuelTypeOption = findFuelTypeOption(optionsData, fuelTypeName)
  return findFuelCodeDetails(fuelTypeOption, getFuelCode(fuelCodeValue))
}

export const calculateRenewableClaimColumnVisibility = (
  _rowData: RenewableClaimRow | RenewableClaimRow[],
  _optionsData: RenewableClaimOptions | undefined,
  compliancePeriod: string | number
): RenewableClaimColumnVisibility => {
  const complianceYear = parseInt(String(compliancePeriod), 10)
  if (Number.isNaN(complianceYear) || complianceYear < NEW_REGULATION_YEAR) {
    return {
      shouldShowIsCanadaProduced: false,
      shouldShowIsQ1Supplied: false
    }
  }

  return {
    shouldShowIsCanadaProduced: complianceYear >= NEW_REGULATION_YEAR,
    shouldShowIsQ1Supplied: complianceYear === NEW_REGULATION_YEAR
  }
}

export const canEditQ1Supplied = (
  row: RenewableClaimRow | null | undefined,
  optionsData: RenewableClaimOptions | undefined,
  compliancePeriod: string | number,
  approvedFuelCodeValue = 'Fuel code - section 19 (b) (i)',
  {
    isEligibleRenewableOverride,
    isCanadianOverride,
    requireApprovedProvision = true
  }: {
    isEligibleRenewableOverride?: (
      row: RenewableClaimRow,
      options: RenewableClaimOptions | undefined
    ) => boolean
    isCanadianOverride?: (
      row: RenewableClaimRow,
      options: RenewableClaimOptions | undefined
    ) => boolean
    requireApprovedProvision?: boolean
  } = {}
): boolean => {
  if (!row) {
    return false
  }
  const complianceYear = parseInt(String(compliancePeriod), 10)
  if (Number.isNaN(complianceYear) || complianceYear !== NEW_REGULATION_YEAR) {
    return false
  }
  const provision = getProvisionName(row.provisionOfTheAct)
  const hasProvision = typeof provision === 'string'
  if (
    requireApprovedProvision &&
    hasProvision &&
    provision !== approvedFuelCodeValue
  ) {
    return false
  }
  const isEligible =
    typeof isEligibleRenewableOverride === 'function'
      ? isEligibleRenewableOverride(row, optionsData)
      : isEligibleRenewableFuel(
          getName(row.fuelType),
          getCategory(row.fuelCategory),
          optionsData,
          complianceYear
        )
  if (!isEligible) {
    return false
  }
  let isCanadian: boolean | null = null
  if (typeof isCanadianOverride === 'function') {
    isCanadian = isCanadianOverride(row, optionsData)
  } else if (row.fuelType || row.fuelCode) {
    isCanadian = isFuelCodeCanadian(
      getName(row.fuelType),
      row.fuelCode,
      optionsData
    )
  }
  if (typeof isCanadian === 'boolean') {
    return !isCanadian
  }
  return true
}

interface RenewableClaimGridApi {
  getColumn?: (column: string) => { isVisible?: () => boolean } | undefined
  setColumnsVisible?: (columns: string[], visible: boolean) => void
}

export const applyRenewableClaimColumnVisibility = (
  gridRef: { current?: { api?: RenewableClaimGridApi } } | null | undefined,
  columnVisibility?: Partial<RenewableClaimColumnVisibility> | null
): void => {
  const api = gridRef?.current?.api
  if (!api) return
  const { shouldShowIsCanadaProduced = false, shouldShowIsQ1Supplied = false } =
    columnVisibility || {}
  const currentIsCanadaProduced = api
    .getColumn?.('isCanadaProduced')
    ?.isVisible?.()
  const currentIsQ1Supplied = api.getColumn?.('isQ1Supplied')?.isVisible?.()
  if (currentIsCanadaProduced !== shouldShowIsCanadaProduced) {
    api.setColumnsVisible?.(['isCanadaProduced'], shouldShowIsCanadaProduced)
  }
  if (currentIsQ1Supplied !== shouldShowIsQ1Supplied) {
    api.setColumnsVisible?.(['isQ1Supplied'], shouldShowIsQ1Supplied)
  }
}

export const canEditCanadianProduced = (
  row: RenewableClaimRow,
  compliancePeriod: string | number,
  optionsData: RenewableClaimOptions | undefined
): boolean => {
  const complianceYear = parseInt(String(compliancePeriod), 10)
  if (Number.isNaN(complianceYear) || complianceYear < NEW_REGULATION_YEAR) {
    return false
  }
  const isEligible = isEligibleRenewableFuel(
    getName(row.fuelType),
    getCategory(row.fuelCategory),
    optionsData,
    complianceYear
  )
  const provision = getProvisionName(row.provisionOfTheAct)
  const isDefaultCI = provision === DEFAULT_CI_FUEL_CODE
  return complianceYear >= NEW_REGULATION_YEAR && isEligible && isDefaultCI
}

export const isNotionalTransferRenewableClaimEditable = (
  row: { fuelCategory?: string },
  compliancePeriod: string | number
): boolean => {
  const complianceYear = parseInt(String(compliancePeriod), 10)
  if (Number.isNaN(complianceYear) || complianceYear < NEW_REGULATION_YEAR) {
    return false
  }
  return (
    complianceYear >= NEW_REGULATION_YEAR &&
    (row.fuelCategory === 'Diesel' ||
      (row.fuelCategory === 'Gasoline' && complianceYear > NEW_REGULATION_YEAR))
  )
}

export default {
  isEligibleRenewableFuel,
  isFuelCodeCanadian,
  getFuelCodeDetails,
  calculateRenewableClaimColumnVisibility,
  canEditQ1Supplied,
  applyRenewableClaimColumnVisibility,
  canEditCanadianProduced
}
