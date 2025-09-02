import { v4 as uuid } from 'uuid'
import { isArrayEmpty } from '@/utils/array.js'
import { DEFAULT_CI_FUEL, DEFAULT_CI_FUEL_CODE, NEW_REGULATION_YEAR } from '@/constants/common'

/**
 * Processes raw fuel supply data for grid consumption
 */
export const processFuelSupplyRowData = ({
  fuelSupplyData,
  fuelSuppliesLoading,
  complianceReportId,
  compliancePeriod,
  isSupplemental
}) => {
  if (fuelSuppliesLoading || !fuelSupplyData) return []

  const baseRowData = isArrayEmpty(fuelSupplyData)
    ? []
    : fuelSupplyData.fuelSupplies.map((item) => ({
        ...item,
        complianceReportId,
        compliancePeriod,
        isNewSupplementalEntry:
          isSupplemental && item.complianceReportId === +complianceReportId,
        id: uuid()
      }))

  return [
    ...baseRowData,
    { id: uuid(), complianceReportId, compliancePeriod }
  ]
}

/**
 * Determines which columns should be visible based on row data and fuel types
 */
export const calculateColumnVisibility = (rowData, optionsData, compliancePeriod) => {
  if (!optionsData?.fuelTypes || isArrayEmpty(rowData)) {
    return {
      shouldShowIsCanadaProduced: false,
      shouldShowIsQ1Supplied: false
    }
  }

  let shouldShowIsCanadaProduced = false
  let shouldShowIsQ1Supplied = false
  const complianceYear = parseInt(compliancePeriod, 10)

  for (const row of rowData) {
    if (!row.fuelType) continue

    const fuelType = optionsData.fuelTypes.find(
      (obj) => row.fuelType === obj.fuelType
    )

    if (!fuelType) continue

    const isRenewable = fuelType.renewable
    let isCanadian = false

    if (row.fuelCode) {
      const fuelCodeDetails = fuelType.fuelCodes?.find(
        (fc) =>
          fc.fuelCode === row.fuelCode ||
          fc.fuelCode === row.fuelCode.replace('C-', '')
      )
      isCanadian = fuelCodeDetails?.fuelProductionFacilityCountry === 'Canada'
    }

    // Check conditions for showing columns
    if (
      (row.fuelCategory === 'Diesel' &&
        complianceYear >= NEW_REGULATION_YEAR &&
        isRenewable &&
        row.provisionOfTheAct === DEFAULT_CI_FUEL_CODE) ||
      isCanadian
    ) {
      shouldShowIsCanadaProduced = true
    }

    if (
      row.fuelCategory === 'Diesel' &&
      complianceYear === NEW_REGULATION_YEAR &&
      isRenewable &&
      !isCanadian &&
      row.provisionOfTheAct != DEFAULT_CI_FUEL_CODE
    ) {
      shouldShowIsQ1Supplied = true
    }

    // Early exit if both conditions are met
    if (shouldShowIsCanadaProduced && shouldShowIsQ1Supplied) break
  }

  return { shouldShowIsCanadaProduced, shouldShowIsQ1Supplied }
}

/**
 * Updates grid column visibility
 */
export const updateGridColumnsVisibility = (gridRef, columnVisibility) => {
  const api = gridRef.current?.api
  if (!api) return

  const { shouldShowIsCanadaProduced, shouldShowIsQ1Supplied } = columnVisibility

  // Only update if visibility actually changed
  const currentIsCanadaProduced = api.getColumn('isCanadaProduced')?.isVisible()
  const currentIsQ1Supplied = api.getColumn('isQ1Supplied')?.isVisible()

  if (currentIsCanadaProduced !== shouldShowIsCanadaProduced) {
    api.setColumnsVisible(['isCanadaProduced'], shouldShowIsCanadaProduced)
  }

  if (currentIsQ1Supplied !== shouldShowIsQ1Supplied) {
    api.setColumnsVisible(['isQ1Supplied'], shouldShowIsQ1Supplied)
  }
}

/**
 * Handles fuel type selection changes
 */
export const handleFuelTypeChange = (params, optionsData, updateRowDataValues) => {
  const selectedFuelType = optionsData?.fuelTypes?.find(
    (obj) => params.node.data.fuelType === obj.fuelType
  )

  if (selectedFuelType) {
    const fuelCategoryOptions = selectedFuelType.fuelCategories.map(
      (item) => item.fuelCategory
    )
    const endUseTypes = selectedFuelType.eerRatios.map(
      (item) => item.endUseType
    )

    updateRowDataValues(params.node, {
      fuelCategory:
        fuelCategoryOptions.length === 1 ? fuelCategoryOptions[0] : null,
      endUseType: endUseTypes.length === 1 ? endUseTypes[0].type : null,
      provisionOfTheAct:
        selectedFuelType.provisions.length === 1
          ? selectedFuelType.provisions[0].name
          : null,
      isCanadaProduced: false,
      isQ1Supplied: false
    })
  }
}

/**
 * Handles fuel category selection changes
 */
export const handleFuelCategoryChange = (params, optionsData, updateRowDataValues) => {
  const selectedFuelType = optionsData?.fuelTypes?.find(
    (obj) => params.node.data.fuelType === obj.fuelType
  )

  if (selectedFuelType) {
    const endUseTypes = selectedFuelType.eerRatios
      .filter(
        (item) =>
          item.fuelCategory.fuelCategory === params.data.fuelCategory
      )
      .map((item) => item.endUseType)

    updateRowDataValues(params.node, {
      endUseType: endUseTypes.length === 1 ? endUseTypes[0].type : null,
      provisionOfTheAct:
        selectedFuelType.provisions.length === 1
          ? selectedFuelType.provisions[0].name
          : null,
      isCanadaProduced: false,
      isQ1Supplied: false
    })
  }
}

/**
 * Validation utility for fuel supply data
 */
export const validateFuelSupply = (params, validationFn, errorMessage, alertRef, field = null) => {
  const value = field ? params.node?.data[field] : params

  if (field && params.colDef.field !== field) {
    return true
  }

  if (!validationFn(value)) {
    alertRef.current?.triggerAlert({
      message: errorMessage,
      severity: 'error'
    })
    return false
  }
  return true
}

/**
 * Processes cell editing completion
 */
export const processCellEditingComplete = async ({
  params,
  validateFn,
  alertRef,
  saveRow,
  t,
  setErrors,
  setWarnings
}) => {
  if (params.oldValue === params.newValue) return null

  const isValid = validateFn(
    params,
    (value) => value !== null && !isNaN(value) && value > 0,
    'Quantity supplied must be greater than 0.',
    alertRef,
    'quantity'
  )

  if (!isValid) return null

  params.node.updateData({
    ...params.node.data,
    validationStatus: 'pending'
  })

  let updatedData = cleanEmptyStringValues(params.node.data)

  if (updatedData.fuelType === 'Other') {
    updatedData.ciOfFuel = DEFAULT_CI_FUEL[updatedData.fuelCategory]
  }

  // This would need to be imported from the schedules utility
  updatedData = await handleScheduleSave({
    alertRef,
    idField: 'fuelSupplyId',
    labelPrefix: 'fuelSupply:fuelSupplyColLabels',
    params,
    setErrors,
    setWarnings,
    saveRow,
    t,
    updatedData
  })

  return updatedData
}

/**
 * Creates grid options configuration
 */
export const createGridOptions = (t) => ({
  overlayNoRowsTemplate: t('fuelSupply:noFuelSuppliesFound'),
  autoSizeStrategy: {
    type: 'fitCellContents',
    defaultMinWidth: 50,
    defaultMaxWidth: 600
  }
})