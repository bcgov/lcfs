import { DEFAULT_CI_FUEL_CODE, NEW_REGULATION_YEAR } from '@/constants/common'
const normalize = (value) => (value || '').toLowerCase()
const GASOLINE_ELIGIBLE_TYPES = new Set(
  ['Renewable gasoline', 'Ethanol', 'Renewable naphtha', 'Other'].map(normalize)
)
const DIESEL_ELIGIBLE_TYPES = new Set(
  ['Biodiesel', 'HDRD', 'Other diesel fuel', 'Other'].map(normalize)
)
const stripPrefix = (fuelCode) => {
  if (!fuelCode) return fuelCode
  return fuelCode.startsWith('C-') ? fuelCode.substring(2) : fuelCode
}
const findFuelTypeOption = (optionsData, fuelTypeName) =>
  optionsData?.fuelTypes?.find((item) => item.fuelType === fuelTypeName)
const findFuelCodeDetails = (fuelTypeOption, fuelCodeValue) => {
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
  fuelTypeName,
  fuelCategory,
  optionsData
) => {
  if (!fuelTypeName || !fuelCategory) {
    return false
  }
  const fuelTypeOption = findFuelTypeOption(optionsData, fuelTypeName)
  if (!fuelTypeOption?.renewable) {
    return false
  }
  const normalizedCategory = normalize(fuelCategory)
  const normalizedFuelType = normalize(fuelTypeName)
  if (normalizedCategory === 'gasoline') {
    return GASOLINE_ELIGIBLE_TYPES.has(normalizedFuelType)
  }
  if (normalizedCategory === 'diesel') {
    return DIESEL_ELIGIBLE_TYPES.has(normalizedFuelType)
  }
  return false
}
export const isFuelCodeCanadian = (fuelTypeName, fuelCodeValue, optionsData) => {
  const fuelTypeOption = findFuelTypeOption(optionsData, fuelTypeName)
  if (!fuelTypeOption) {
    return false
  }
  const fuelCodeDetails = findFuelCodeDetails(fuelTypeOption, fuelCodeValue)
  if (!fuelCodeDetails?.fuelProductionFacilityCountry) {
    return false
  }
  return (
    normalize(fuelCodeDetails.fuelProductionFacilityCountry) === 'canada'
  )
}
export const getFuelCodeDetails = (fuelTypeName, fuelCodeValue, optionsData) => {
  const fuelTypeOption = findFuelTypeOption(optionsData, fuelTypeName)
  return findFuelCodeDetails(fuelTypeOption, fuelCodeValue)
}
export const calculateRenewableClaimColumnVisibility = (
  rowData,
  optionsData,
  compliancePeriod,
  approvedFuelCodeValue = 'Fuel code - section 19 (b) (i)'
) => {
  const complianceYear = parseInt(compliancePeriod, 10)
  if (
    !optionsData?.fuelTypes ||
    !Array.isArray(rowData) ||
    rowData.length === 0 ||
    Number.isNaN(complianceYear) ||
    complianceYear < NEW_REGULATION_YEAR
  ) {
    return {
      shouldShowIsCanadaProduced: false,
      shouldShowIsQ1Supplied: false
    }
  }
  let shouldShowIsCanadaProduced = false
  let shouldShowIsQ1Supplied = false
  for (const row of rowData) {
    if (!row?.fuelType) continue
    const isEligible = isEligibleRenewableFuel(
      row.fuelType,
      row.fuelCategory,
      optionsData
    )
    if (!isEligible) continue
    const isCanadian = isFuelCodeCanadian(
      row.fuelType,
      row.fuelCode,
      optionsData
    )
    if (row.provisionOfTheAct === DEFAULT_CI_FUEL_CODE || isCanadian) {
      shouldShowIsCanadaProduced = true
    }
    if (
      complianceYear === NEW_REGULATION_YEAR &&
      canEditQ1Supplied(row, optionsData, compliancePeriod, approvedFuelCodeValue)
    ) {
      shouldShowIsQ1Supplied = true
    }
    if (shouldShowIsCanadaProduced && shouldShowIsQ1Supplied) {
      break
    }
  }
  return { shouldShowIsCanadaProduced, shouldShowIsQ1Supplied }
}
export const canEditQ1Supplied = (
  row,
  optionsData,
  compliancePeriod,
  approvedFuelCodeValue = 'Fuel code - section 19 (b) (i)',
  {
    isEligibleRenewableOverride,
    isCanadianOverride,
    requireApprovedProvision = true
  } = {}
) => {
  if (!row) {
    return false
  }
  const complianceYear = parseInt(compliancePeriod, 10)
  if (Number.isNaN(complianceYear) || complianceYear !== NEW_REGULATION_YEAR) {
    return false
  }
  const hasProvision = typeof row.provisionOfTheAct === 'string'
  if (
    requireApprovedProvision &&
    hasProvision &&
    row.provisionOfTheAct !== approvedFuelCodeValue
  ) {
    return false
  }
  const isEligible = typeof isEligibleRenewableOverride === 'function'
    ? isEligibleRenewableOverride(row, optionsData)
    : isEligibleRenewableFuel(row.fuelType, row.fuelCategory, optionsData)
  if (!isEligible) {
    return false
  }
  let isCanadian = null
  if (typeof isCanadianOverride === 'function') {
    isCanadian = isCanadianOverride(row, optionsData)
  } else if (row.fuelType || row.fuelCode) {
    isCanadian = isFuelCodeCanadian(
      row.fuelType,
      row.fuelCode,
      optionsData
    )
  }
  if (typeof isCanadian === 'boolean') {
    return !isCanadian
  }
  return true
}
export const applyRenewableClaimColumnVisibility = (gridRef, columnVisibility) => {
  const api = gridRef?.current?.api
  if (!api) return
  const {
    shouldShowIsCanadaProduced = false,
    shouldShowIsQ1Supplied = false
  } = columnVisibility || {}
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
export default {
  isEligibleRenewableFuel,
  isFuelCodeCanadian,
  getFuelCodeDetails,
  calculateRenewableClaimColumnVisibility,
  canEditQ1Supplied,
  applyRenewableClaimColumnVisibility
}