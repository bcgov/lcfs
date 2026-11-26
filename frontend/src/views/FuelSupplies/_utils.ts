import { v4 as uuid } from 'uuid'
import { isArrayEmpty } from '@/utils/array'
import { DEFAULT_CI_FUEL } from '@/constants/common'
import { handleScheduleSave } from '@/utils/schedules'
import { cleanEmptyStringValues } from '@/utils/formatters'
import {
  calculateRenewableClaimColumnVisibility,
  applyRenewableClaimColumnVisibility
} from '@/utils/renewableClaimUtils'
import type { MutableRefObject } from 'react'
import type { GridOptions } from 'ag-grid-community'
import type { RowStyle } from 'ag-grid-community'
import type { BCGridRow } from '@/components/BCDataGrid/types'
import type { FloatingAlertHandle } from '@/components/BCAlert/FloatingAlert'
import type { OptionsData, GridErrors, GridWarnings } from '@/types/schema'
import type {
  ScheduleSaveParams,
  ScheduleSaveResponse
} from '@/utils/schedules'
import type { RenewableClaimColumnVisibility } from '@/utils/renewableClaimUtils'
import colors from '@/themes/base/colors'

export type FuelSupplyRow = Record<string, unknown> & {
  fuelSupplyId?: number | string
  complianceReportId?: number | string
  compliancePeriod?: number | string
  fuelType?: string
  fuelCategory?: string
  quantity?: number | string | null
  id?: string | number
  isNewSupplementalEntry?: boolean
  validationStatus?: string
}

export type FuelSupplyCellParams = {
  oldValue?: unknown
  newValue?: unknown
  data?: FuelSupplyRow
  node: {
    data?: FuelSupplyRow
    rowIndex?: number | null
    updateData: (data: FuelSupplyRow) => void
    setDataValue: (key: string, value: unknown) => void
  }
  api?: object
  column?: { getColId: () => string }
  colDef?: { field?: string }
}

type AlertRef = MutableRefObject<FloatingAlertHandle | null>

export const getFuelSupplyChangelogRowStyle = (
  actionType: unknown,
  highlight: boolean
): RowStyle | undefined => {
  if (!highlight) return undefined
  if (actionType === 'DELETE') {
    return { backgroundColor: colors.alerts.error.background }
  }
  if (actionType === 'CREATE') {
    return { backgroundColor: colors.alerts.success.background }
  }
  return undefined
}

export const getFuelSupplyRowId = (fuelSupplyId: string | number): string =>
  fuelSupplyId.toString()

const isFuelSupplyCellParams = (
  params: FuelSupplyCellParams | number | string | null
): params is FuelSupplyCellParams =>
  typeof params === 'object' && params !== null && 'node' in params

/**
 * Processes raw fuel supply data for grid consumption
 */
export const processFuelSupplyRowData = ({
  fuelSupplyData,
  fuelSuppliesLoading,
  complianceReportId,
  compliancePeriod,
  isSupplemental
}: {
  fuelSupplyData?: { fuelSupplies: FuelSupplyRow[] } | null
  fuelSuppliesLoading: boolean
  complianceReportId?: string | number
  compliancePeriod?: string | number
  isSupplemental: boolean
}): FuelSupplyRow[] => {
  if (fuelSuppliesLoading || !fuelSupplyData) return []

  const baseRowData = isArrayEmpty(fuelSupplyData)
    ? []
    : fuelSupplyData.fuelSupplies.map((item) => ({
        ...item,
        complianceReportId,
        compliancePeriod,
        isNewSupplementalEntry:
          isSupplemental &&
          item.complianceReportId === Number(complianceReportId),
        id: item.fuelSupplyId ? `fs-${item.fuelSupplyId}` : uuid()
      }))

  return [
    ...baseRowData,
    { id: 'new-fuel-supply-draft-row', complianceReportId, compliancePeriod }
  ]
}

/**
 * Determines which columns should be visible based on row data and fuel types
 */
export const calculateColumnVisibility = (
  rowData: FuelSupplyRow[],
  optionsData: OptionsData | undefined,
  compliancePeriod: string | number | undefined
): RenewableClaimColumnVisibility =>
  calculateRenewableClaimColumnVisibility(
    Array.isArray(rowData) ? rowData : [],
    optionsData,
    compliancePeriod ?? ''
  )

/**
 * Updates grid column visibility
 */
export const updateGridColumnsVisibility = (
  gridRef: Parameters<typeof applyRenewableClaimColumnVisibility>[0],
  columnVisibility: ReturnType<typeof calculateColumnVisibility>
) => {
  applyRenewableClaimColumnVisibility(gridRef, columnVisibility)
}

/**
 * Handles fuel type selection changes
 */
export const handleFuelTypeChange = (
  params: FuelSupplyCellParams,
  optionsData: OptionsData | undefined,
  updateRowDataValues: (
    node: FuelSupplyCellParams['node'],
    updates: Record<string, unknown>
  ) => void
) => {
  const selectedFuelType = optionsData?.fuelTypes?.find(
    (obj) => params.node.data?.fuelType === obj.fuelType
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
      endUseType: endUseTypes.length === 1 ? endUseTypes[0]?.type : null,
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
export const handleFuelCategoryChange = (
  params: FuelSupplyCellParams,
  optionsData: OptionsData | undefined,
  updateRowDataValues: (
    node: FuelSupplyCellParams['node'],
    updates: Record<string, unknown>
  ) => void
) => {
  const selectedFuelType = optionsData?.fuelTypes?.find(
    (obj) => params.node.data?.fuelType === obj.fuelType
  )

  if (selectedFuelType) {
    const endUseTypes = selectedFuelType.eerRatios
      .filter(
        (item) => item.fuelCategory.fuelCategory === params.data?.fuelCategory
      )
      .map((item) => item.endUseType)

    updateRowDataValues(params.node, {
      endUseType: endUseTypes.length === 1 ? endUseTypes[0]?.type : null,
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
export const validateFuelSupply = (
  params: FuelSupplyCellParams | number | string | null,
  validationFn: (value: unknown) => boolean,
  errorMessage: string,
  alertRef: AlertRef,
  field: string | null = null
) => {
  const cellParams = isFuelSupplyCellParams(params) ? params : undefined
  const value = field && cellParams ? cellParams.node?.data?.[field] : params

  if (field && cellParams?.colDef?.field !== field) {
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
}: {
  params: FuelSupplyCellParams
  validateFn: typeof validateFuelSupply
  alertRef: AlertRef
  saveRow: (row: FuelSupplyRow) => Promise<ScheduleSaveResponse>
  t: (key: string, options?: { defaultValue?: string }) => string
  setErrors: (errors: GridErrors) => void
  setWarnings: (warnings: GridWarnings) => void
}): Promise<FuelSupplyRow | null> => {
  if (!params.node.data || params.oldValue === params.newValue) return null

  const isValid = validateFn(
    params,
    (value) =>
      value !== null && !Number.isNaN(Number(value)) && Number(value) > 0,
    'Quantity supplied must be greater than 0.',
    alertRef,
    'quantity'
  )

  if (!isValid) return null

  params.node.updateData({
    ...params.node.data,
    validationStatus: 'pending'
  })

  let updatedData: FuelSupplyRow = {
    ...cleanEmptyStringValues(params.node.data)
  }

  if (updatedData.fuelType === 'Other') {
    updatedData.ciOfFuel =
      DEFAULT_CI_FUEL[updatedData.fuelCategory as keyof typeof DEFAULT_CI_FUEL]
  }

  // This would need to be imported from the schedules utility
  updatedData = await handleScheduleSave({
    alertRef,
    idField: 'fuelSupplyId',
    labelPrefix: 'fuelSupply:fuelSupplyColLabels',
    // AG Grid exposes a richer event/node API than the shared schedule helper requires.
    params: params as ScheduleSaveParams<FuelSupplyRow>,
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
export const createGridOptions = (
  t: (key: string) => string
): Pick<
  GridOptions<BCGridRow>,
  'overlayNoRowsTemplate' | 'autoSizeStrategy'
> => ({
  overlayNoRowsTemplate: t('fuelSupply:noFuelSuppliesFound'),
  autoSizeStrategy: {
    type: 'fitCellContents' as const,
    defaultMinWidth: 50,
    defaultMaxWidth: 600
  }
})
