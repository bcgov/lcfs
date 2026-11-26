import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { ROUTES, buildPath } from '@/routes/routes'
import { useComplianceReportWithCache } from '@/hooks/useComplianceReports'
import {
  useGetAllOtherUsesList,
  useOtherUsesOptions,
  useSaveOtherUses
} from '@/hooks/useOtherUses'
import { cleanEmptyStringValues } from '@/utils/formatters'
import {
  handleScheduleDelete,
  handleScheduleSave,
  type ScheduleGridParams,
  type ScheduleSaveParams
} from '@/utils/schedules'
import Grid2 from '@mui/material/Grid2'
import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { defaultColDef, otherUsesColDefs, isFuelCodeProvision } from './_schema'
import { NEW_REGULATION_YEAR } from '@/constants/common'
import {
  calculateRenewableClaimColumnVisibility,
  applyRenewableClaimColumnVisibility
} from '@/utils/renewableClaimUtils'
import { isOtherExpectedUseMissing } from './otherUsesHelpers'
import type { FloatingAlertHandle } from '@/components/BCAlert/FloatingAlert'
import type {
  BCGridEditContext,
  BCGridRow,
  BCGridRef
} from '@/components/BCDataGrid/types'
import type {
  FuelType,
  GridErrors,
  GridWarnings,
  OptionsData
} from '@/types/schema'
import type {
  CellValueChangedEvent,
  FirstDataRenderedEvent,
  GridReadyEvent,
  IRowNode
} from 'ag-grid-community'

interface OtherUseRow extends BCGridRow {
  id?: string | number
  complianceReportId?: number
  compliancePeriod?: string
  isValid?: boolean
  isNewSupplementalEntry?: boolean
  fuelType?: string
  fuelCode?: string
  provisionOfTheAct?: string
  expectedUse?: string | null
  rationale?: string | null
  [key: string]: unknown
}

interface OtherUseFuelType extends FuelType {
  units?: string
}

const isScheduleGridParams = (
  params: unknown
): params is ScheduleGridParams<OtherUseRow> =>
  typeof params === 'object' &&
  params !== null &&
  'node' in params &&
  'api' in params

export const AddEditOtherUses = () => {
  const [rowData, setRowData] = useState<OtherUseRow[]>([])
  const [errors, setErrors] = useState<GridErrors>({})
  const [warnings, setWarnings] = useState<GridWarnings>({})

  const gridRef = useRef<BCGridRef['current']>(null)
  const alertRef = useRef<FloatingAlertHandle>(null)
  const location = useLocation()
  const { t } = useTranslation(['common', 'otherUses', 'reports'])
  const { complianceReportId, compliancePeriod } = useParams<{
    complianceReportId: string
    compliancePeriod: string
  }>()

  const {
    data: rawOptionsData,
    isLoading: optionsLoading,
    isFetched
  } = useOtherUsesOptions({ compliancePeriod })
  const optionsData = rawOptionsData as OptionsData | undefined

  const { mutateAsync: saveRow } = useSaveOtherUses(complianceReportId)
  const navigate = useNavigate()

  const { data: complianceReport, isLoading: complianceReportLoading } =
    useComplianceReportWithCache(complianceReportId!)

  const { data: otherUses, isLoading: usesLoading } = useGetAllOtherUsesList({
    complianceReportId,
    changelog: complianceReport?.report?.version !== 0
  })

  const isSupplemental = useMemo(
    () => complianceReport?.report?.version !== 0,
    [complianceReport?.report?.version]
  )

  const numericComplianceReportId = useMemo(
    () => Number(complianceReportId),
    [complianceReportId]
  )

  // Utility function to ensure consistent row ID assignment
  const ensureRowId = useCallback(
    (row: OtherUseRow): OtherUseRow => {
      if (row.id) return row

      return {
        ...row,
        id: uuid(),
        isValid: true,
        complianceReportId: numericComplianceReportId,
        ...(isSupplemental &&
          row.complianceReportId === numericComplianceReportId && {
            isNewSupplementalEntry: true
          })
      }
    },
    [numericComplianceReportId, isSupplemental]
  )

  const processRowData = useCallback(
    (data: OtherUseRow[] | undefined) => {
      if (!data?.length) {
        return [
          {
            id: uuid(),
            complianceReportId: numericComplianceReportId,
            compliancePeriod,
            isValid: true
          }
        ]
      }

      const processedData: OtherUseRow[] = data.map((item) => ({
        ...ensureRowId(item),
        complianceReportId: numericComplianceReportId,
        isNewSupplementalEntry:
          isSupplemental &&
          item.complianceReportId === numericComplianceReportId
      }))

      // Add a new empty row for user input when existing data is present
      processedData.push({
        id: uuid(),
        complianceReportId: numericComplianceReportId,
        compliancePeriod,
        isValid: true
      })

      return processedData
    },
    [ensureRowId, numericComplianceReportId, compliancePeriod, isSupplemental]
  )

  // Handle location state alerts
  useEffect(() => {
    if (location.state?.message) {
      alertRef.current?.triggerAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
    }
  }, [location.state])

  // Initialize and update row data
  useEffect(() => {
    if (usesLoading || !isFetched) return

    try {
      const processedData = processRowData(
        otherUses as OtherUseRow[] | undefined
      )
      setRowData(processedData)
    } catch (error) {
      console.error('Error processing row data:', error)
      alertRef.current?.triggerAlert({
        message: t('otherUses:otherUsesLoadFailMsg'),
        severity: 'error'
      })
      // Fallback to empty row
      setRowData([
        {
          id: uuid(),
          complianceReportId: numericComplianceReportId,
          compliancePeriod,
          isValid: true
        }
      ])
    }
  }, [
    otherUses,
    usesLoading,
    isFetched,
    processRowData,
    t,
    numericComplianceReportId,
    compliancePeriod
  ])

  const findCiOfFuel = useCallback(
    (data: OtherUseRow, optionsData?: OptionsData) => {
      if (!optionsData?.fuelTypes || !data.fuelType) return 0

      const fuelType = optionsData.fuelTypes.find(
        (obj) => data.fuelType === obj.fuelType
      )

      if (!fuelType) return 0

      if (isFuelCodeProvision(data.provisionOfTheAct)) {
        const fuelCode = fuelType.fuelCodes?.find(
          (item) => item.fuelCode === data.fuelCode
        )
        return fuelCode?.carbonIntensity || 0
      }

      return fuelType.defaultCarbonIntensity || 0
    },
    []
  )

  const validate = useCallback(
    (
      params: BCGridEditContext<BCGridRow>,
      validationFn: (value: unknown) => boolean,
      errorMessage: string,
      field: string | null = null
    ) => {
      const value = field ? params.node.data?.[field] : params

      if (field && params.colDef?.field !== field) {
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
    },
    []
  )

  const onGridReady = useCallback(
    (params: GridReadyEvent<BCGridRow>) => {
      if (!params.api) return

      try {
        // Auto-focus the last row (new empty row for input) after data is loaded
        setTimeout(() => {
          const lastRowIndex = params.api.getLastDisplayedRowIndex()
          if (lastRowIndex >= 0) {
            params.api.startEditingCell({
              rowIndex: lastRowIndex,
              colKey: 'fuelType'
            })
          }
        }, 100)
      } catch (error) {
        console.error('Error in onGridReady:', error)
        alertRef.current?.triggerAlert({
          message: t('otherUses:otherUsesLoadFailMsg'),
          severity: 'error'
        })
      }
    },
    [t]
  )

  const onAction = useCallback(
    async (action: string, params?: unknown) => {
      if (action === 'delete' || action === 'undo') {
        if (!isScheduleGridParams(params)) return
        await handleScheduleDelete(
          params,
          'otherUsesId',
          saveRow,
          alertRef,
          setRowData,
          { complianceReportId: numericComplianceReportId },
          'fuelType' // First editable column for focus after clearing
        )
      }
    },
    [saveRow, numericComplianceReportId]
  )

  const updateNodeData = useCallback(
    (node: IRowNode<BCGridRow>, field: string, value: unknown) => {
      if (node?.setDataValue) {
        node.setDataValue(field, value)
      }
    },
    []
  )

  const updateGridColumnsVisibility = useCallback(() => {
    if (!gridRef.current?.api) return

    const columnVisibility = calculateRenewableClaimColumnVisibility(
      rowData,
      optionsData as OptionsData,
      compliancePeriod ?? ''
    )

    applyRenewableClaimColumnVisibility(gridRef, columnVisibility)
  }, [rowData, optionsData, compliancePeriod])

  const onCellValueChanged = useCallback(
    async (params: CellValueChangedEvent<BCGridRow>) => {
      if (!params.data || !params.node.data) return
      const data = params.data as OtherUseRow
      const field = params.colDef.field
      if (
        !field ||
        !['fuelType', 'fuelCode', 'provisionOfTheAct'].includes(field)
      ) {
        return
      }

      const fuelType = optionsData?.fuelTypes?.find(
        (obj) => data.fuelType === obj.fuelType
      ) as OtherUseFuelType | undefined

      if (!fuelType) return

      const ciOfFuel = findCiOfFuel(data, optionsData as OptionsData)
      updateNodeData(params.node, 'ciOfFuel', ciOfFuel)

      // Auto-populate fields based on the selected fuel type
      if (params.colDef.field === 'fuelType') {
        // Auto-populate units
        updateNodeData(params.node, 'units', fuelType.units || '')

        // Auto-populate fuel category
        const fuelCategoryOptions =
          fuelType.fuelCategories?.map((item) => item.category) || []
        const categoryValue =
          fuelCategoryOptions.length === 1 ? fuelCategoryOptions[0] : null
        updateNodeData(params.node, 'fuelCategory', categoryValue)

        // Auto-populate provision of the act
        const provisions =
          fuelType.provisionOfTheAct?.map((provision) => provision.name) || []
        const provisionValue = provisions.length === 1 ? provisions[0] : null
        updateNodeData(params.node, 'provisionOfTheAct', provisionValue)
      }

      // Auto-populate fuel code for approved fuel code scenarios
      if (isFuelCodeProvision(data.provisionOfTheAct)) {
        const fuelCodeOptions =
          fuelType.fuelCodes?.map((code) => code.fuelCode) || []
        if (fuelCodeOptions.length === 1) {
          updateNodeData(params.node, 'fuelCode', fuelCodeOptions[0] || null)
          updateNodeData(
            params.node,
            'fuelCodeId',
            fuelType.fuelCodes[0]?.fuelCodeId || null
          )
        }
      }
      updateNodeData(params.node, 'isCanadaProduced', false)
      updateNodeData(params.node, 'isQ1Supplied', false)
      setTimeout(() => {
        updateGridColumnsVisibility()
      }, 0)
    },
    [optionsData, findCiOfFuel, updateNodeData, updateGridColumnsVisibility]
  )

  const onCellEditingStopped = useCallback(
    async (params: BCGridEditContext<BCGridRow>) => {
      if (!params.data) return
      const data = params.data as OtherUseRow
      if (params.oldValue === params.newValue) return

      const rowId = data.id
      const nextErrors = { ...errors }

      const isValid = validate(
        params,
        (value) => value !== null && !isNaN(Number(value)) && Number(value) > 0,
        'Quantity supplied must be greater than 0.',
        'quantitySupplied'
      )

      if (!isValid) {
        return
      }

      if (isOtherExpectedUseMissing(data)) {
        setErrors({
          ...nextErrors,
          [String(rowId)]: ['rationale']
        })
        params.node.updateData({
          ...params.data,
          validationStatus: 'error'
        })
        alertRef.current?.triggerAlert({
          message:
            'Unable to save row: If other, enter expected use is required when Expected use is Other.',
          severity: 'error'
        })
        return
      }

      if (rowId && nextErrors[rowId]?.includes('rationale')) {
        const remainingFields = nextErrors[rowId].filter(
          (field) => field !== 'rationale'
        )

        if (remainingFields.length > 0) {
          nextErrors[rowId] = remainingFields
        } else {
          delete nextErrors[rowId]
        }
        setErrors(nextErrors)
      }

      data.complianceReportId = numericComplianceReportId
      data.validationStatus = 'pending'

      alertRef.current?.triggerAlert({
        message: 'Updating row...',
        severity: 'pending'
      })

      try {
        let updatedData = cleanEmptyStringValues(data)

        updatedData = await handleScheduleSave({
          alertRef,
          idField: 'otherUsesId',
          labelPrefix: 'otherUses:otherUsesColLabels',
          params: {
            node: {
              data: params.node.data ?? {},
              updateData: (row) => params.node.updateData(row)
            },
            api: {
              forEachNode: (callback) =>
                params.api.forEachNode((node) =>
                  callback({
                    data: node.data ?? {},
                    updateData: (row) => node.updateData(row)
                  })
                )
            }
          } satisfies ScheduleSaveParams<BCGridRow>,
          setErrors,
          setWarnings,
          saveRow,
          t,
          updatedData
        })

        params.node.updateData(updatedData)
      } catch (error) {
        console.error('Error saving row:', error)
        alertRef.current?.triggerAlert({
          message: t('common:saveError'),
          severity: 'error'
        })
      }
      params.api?.autoSizeAllColumns?.({ scaleUpToFitGridWidth: true })
    },
    [errors, numericComplianceReportId, saveRow, t, validate]
  )

  const handleNavigateBack = useCallback(() => {
    navigate(
      buildPath(ROUTES.REPORTS.VIEW, {
        compliancePeriod: compliancePeriod!,
        complianceReportId: complianceReportId!
      }),
      {
        state: {
          expandedSchedule: 'otherUses',
          message: t('otherUses:scheduleUpdated'),
          severity: 'success'
        }
      }
    )
  }, [navigate, compliancePeriod, complianceReportId, t])

  const columnDefs = useMemo(
    () =>
      otherUsesColDefs(
        optionsData as OptionsData,
        errors,
        warnings,
        isSupplemental,
        compliancePeriod ?? ''
      ),
    [optionsData, errors, warnings, isSupplemental, compliancePeriod]
  )

  const saveButtonProps = useMemo(
    () => ({
      enabled: true,
      text: t('report:saveReturn'),
      onSave: handleNavigateBack,
      confirmText: t('report:incompleteReport'),
      confirmLabel: t('report:returnToReport')
    }),
    [t, handleNavigateBack]
  )

  // Call this function whenever relevant data changes
  useEffect(() => {
    updateGridColumnsVisibility()
  }, [rowData, optionsData, updateGridColumnsVisibility])

  const onFirstDataRendered = useCallback(
    (params: FirstDataRenderedEvent<BCGridRow>) => {
      params.api?.autoSizeAllColumns?.({ scaleUpToFitGridWidth: true })
    },
    []
  )

  // Show loading state
  if (optionsLoading || usesLoading || complianceReportLoading) {
    return <Loading />
  }

  return (
    <Grid2 className="add-edit-other-uses-container" mx={-1}>
      <div className="header">
        <BCTypography variant="h5" color="primary">
          {t('otherUses:newOtherUsesTitle')}
        </BCTypography>
        <BCTypography variant="body4" color="text" my={2} component="div">
          {t('otherUses:newOtherUsesGuide')}
        </BCTypography>
        {parseInt(compliancePeriod ?? '') >= NEW_REGULATION_YEAR && (
          <BCTypography variant="body4" color="text" my={2} component="div">
            {t('otherUses:newOtherUsesGuide2025')}
          </BCTypography>
        )}
      </div>

      <BCGridEditor
        gridRef={gridRef}
        alertRef={alertRef}
        getRowId={(params) => String(params.data.id)}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onGridReady={onGridReady}
        rowData={rowData}
        overlayNoRowsTemplate={t('otherUses:noOtherUsesFound')}
        loading={optionsLoading || usesLoading}
        onAction={onAction}
        onCellValueChanged={onCellValueChanged}
        onCellEditingStopped={onCellEditingStopped}
        onFirstDataRendered={onFirstDataRendered}
        showAddRowsButton
        stopEditingWhenCellsLoseFocus
        saveButtonProps={saveButtonProps}
      />
    </Grid2>
  )
}
