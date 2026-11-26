import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import BCTypography from '@/components/BCTypography'
import { ROUTES, buildPath } from '@/routes/routes'
import {
  useFuelExportOptions,
  useGetFuelExportsList,
  useSaveFuelExport
} from '@/hooks/useFuelExport'
import { isArrayEmpty } from '@/utils/array'
import { handleScheduleDelete, handleScheduleSave } from '@/utils/schedules'
import Grid2 from '@mui/material/Grid2'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { defaultColDef, fuelExportColDefs } from './_schema'
import { useComplianceReportWithCache } from '@/hooks/useComplianceReports'
import type { FloatingAlertHandle } from '@/components/BCAlert/FloatingAlert'
import type {
  BCGridEditContext,
  BCGridRow,
  BCGridRef
} from '@/components/BCDataGrid/types'
import type { GridErrors, GridWarnings, OptionsData } from '@/types/schema'
import type { ScheduleGridParams } from '@/utils/schedules'
import type {
  CellValueChangedEvent,
  ColDef,
  FirstDataRenderedEvent,
  GridOptions,
  GridReadyEvent
} from 'ag-grid-community'

interface FuelExportRow extends BCGridRow {
  id?: string | number
  complianceReportId?: string | number
  compliancePeriod?: string
  isNewSupplementalEntry?: boolean
  validationStatus?: string
  [key: string]: unknown
}

interface FuelExportRelation {
  category?: unknown
  fuelType?: unknown
  name?: unknown
  fuelCode?: unknown
  type?: unknown
}

interface FuelExportRecord extends BCGridRow {
  complianceReportId?: number | string
  ciOfFuel?: number | null
  fuelCategory?: FuelExportRelation | string | null
  fuelType?: FuelExportRelation | string | null
  provisionOfTheAct?: FuelExportRelation | string | null
  fuelCode?: FuelExportRelation | string | null
  endUse?: FuelExportRelation | string | null
}

interface FuelExportData {
  fuelExports: FuelExportRecord[]
}

const isScheduleGridParams = (
  params: unknown
): params is ScheduleGridParams<FuelExportRow> =>
  typeof params === 'object' &&
  params !== null &&
  'node' in params &&
  'api' in params

const relationValue = (
  value: unknown,
  key: 'category' | 'fuelType' | 'name' | 'fuelCode' | 'type'
): unknown => {
  if (typeof value !== 'object' || value === null) return undefined
  const relation = value as Record<string, unknown>
  return relation[key]
}

export const AddEditFuelExports = () => {
  const [rowData, setRowData] = useState<FuelExportRow[]>([])
  const gridRef = useRef<BCGridRef['current']>(null)

  const [errors, setErrors] = useState<GridErrors>({})
  const [warnings, setWarnings] = useState<GridWarnings>({})
  const [columnDefs, setColumnDefs] = useState<ColDef<BCGridRow>[]>([])
  const [gridReady, setGridReady] = useState(false)
  const alertRef = useRef<FloatingAlertHandle>(null)
  // Pending grid timers, cleared on unmount. `onGridReady` is invoked by the
  // grid asynchronously and can land after unmount, so clearing alone is not
  // enough — isMountedRef also stops a late call scheduling a fresh timer.
  // Without both, the queued callback calls setState against a torn-down
  // environment ("window is not defined").
  const gridTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const isMountedRef = useRef(true)
  const location = useLocation()
  const { t } = useTranslation(['common', 'fuelExport'])
  const { complianceReportId, compliancePeriod } = useParams<{
    complianceReportId: string
    compliancePeriod: string
  }>()
  const navigate = useNavigate()
  const { data: currentReport, isLoading } = useComplianceReportWithCache(
    complianceReportId!
  )

  const isSupplemental = currentReport?.report?.version !== 0

  const {
    data: rawOptionsData,
    isLoading: optionsLoading,
    isFetched
  } = useFuelExportOptions({ compliancePeriod })
  const optionsData = rawOptionsData as OptionsData | undefined
  const { mutateAsync: saveRow } = useSaveFuelExport({
    complianceReportId: complianceReportId!
  })

  const { data: rawFuelExportsData, isLoading: fuelExportsLoading } =
    useGetFuelExportsList(
      {
        complianceReportId,
        changelog: isSupplemental
      },
      {}
    )
  const data = rawFuelExportsData as FuelExportData | undefined

  const gridOptions = useMemo<GridOptions<BCGridRow>>(
    () => ({
      overlayNoRowsTemplate: t('fuelExport:noFuelExportsFound'),
      stopEditingWhenCellsLoseFocus: false,
      autoSizeStrategy: {
        type: 'fitCellContents',
        defaultMinWidth: 50,
        defaultMaxWidth: 600,
        scaleUpToFitGridWidth: true
      }
    }),
    [t]
  )

  useEffect(() => {
    if (location.state?.message) {
      alertRef.current?.triggerAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
    }
  }, [location.state])

  const onGridReady = useCallback(
    async (params: GridReadyEvent<BCGridRow>) => {
      if (!isMountedRef.current) return
      if (!isArrayEmpty(data)) {
        const updatedRowData = data!.fuelExports.map((item) => ({
          ...item,
          ciOfFuel: item.ciOfFuel,
          complianceReportId,
          compliancePeriod,
          fuelCategory: relationValue(item.fuelCategory, 'category'),
          fuelType: relationValue(item.fuelType, 'fuelType'),
          provisionOfTheAct: relationValue(item.provisionOfTheAct, 'name'),
          fuelCode: relationValue(item.fuelCode, 'fuelCode'),
          endUse: relationValue(item.endUse, 'type'),
          isNewSupplementalEntry:
            isSupplemental && item.complianceReportId === +complianceReportId!,
          id: uuid()
        }))
        setRowData([
          ...updatedRowData,
          { id: uuid(), complianceReportId, compliancePeriod }
        ])
      } else {
        setRowData([{ id: uuid(), complianceReportId, compliancePeriod }])
      }

      gridTimersRef.current.push(
        setTimeout(() => {
          if (!isMountedRef.current) return
          const lastRowIndex = params.api.getLastDisplayedRowIndex()
          params.api.startEditingCell({
            rowIndex: lastRowIndex,
            colKey: 'fuelTypeId'
          })
          setGridReady(true)
        }, 500)
      )
    },
    [compliancePeriod, complianceReportId, data, isSupplemental]
  )

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      gridTimersRef.current.forEach(clearTimeout)
      gridTimersRef.current = []
    }
  }, [])

  useEffect(() => {
    if (optionsData?.fuelTypes && optionsData.fuelTypes.length > 0) {
      const updatedColumnDefs = fuelExportColDefs(
        optionsData,
        errors,
        warnings,
        gridReady,
        isSupplemental
      )
      setColumnDefs(updatedColumnDefs)
    }
  }, [
    optionsData,
    errors,
    warnings,
    gridReady,
    isSupplemental,
    compliancePeriod
  ])

  useEffect(() => {
    if (!fuelExportsLoading && !isArrayEmpty(data)) {
      const updatedRowData = data!.fuelExports.map((item) => ({
        ...item,
        complianceReportId,
        compliancePeriod,
        fuelCategory: relationValue(item.fuelCategory, 'category'),
        fuelType: relationValue(item.fuelType, 'fuelType'),
        provisionOfTheAct: relationValue(item.provisionOfTheAct, 'name'),
        fuelCode: relationValue(item.fuelCode, 'fuelCode'),
        endUse: relationValue(item.endUse, 'type'),
        isNewSupplementalEntry:
          isSupplemental && item.complianceReportId === +complianceReportId!,
        id: uuid()
      }))
      setRowData([
        ...updatedRowData,
        { id: uuid(), complianceReportId, compliancePeriod }
      ])
    } else {
      setRowData([{ id: uuid(), complianceReportId, compliancePeriod }])
    }
  }, [
    compliancePeriod,
    complianceReportId,
    data,
    fuelExportsLoading,
    isSupplemental
  ])

  const onFirstDataRendered = useCallback(
    (params: FirstDataRenderedEvent<BCGridRow>) => {
      params.api?.autoSizeAllColumns?.({ scaleUpToFitGridWidth: true })
    },
    []
  )

  const onCellValueChanged = useCallback(
    async (params: CellValueChangedEvent<BCGridRow>) => {
      if (!params.data) return
      if (params.column.getColId() === 'fuelTypeId') {
        const selectedFuelType = optionsData?.fuelTypes?.find(
          (obj) => params.data?.fuelType === obj.fuelType
        )
        if (selectedFuelType) {
          const fuelCategoryOptions = selectedFuelType.fuelCategories.map(
            (item) => item.fuelCategory
          )
          const endUseTypes = selectedFuelType.eerRatios.map(
            (item) => item.endUseType
          )

          // Set to null if multiple options, otherwise use first item
          const category =
            fuelCategoryOptions.length === 1 ? fuelCategoryOptions[0] : null
          const endUseValue =
            endUseTypes.length === 1 ? endUseTypes[0]?.type : null
          const provisionValue =
            selectedFuelType.provisions.length === 1
              ? selectedFuelType.provisions[0].name
              : null

          params.node.setDataValue('fuelCategory', category)
          params.node.setDataValue('endUseType', endUseValue)
          params.node.setDataValue('provisionOfTheAct', provisionValue)
        }
      }

      if (params.column.getColId() === 'fuelCategory') {
        const selectedFuelType = optionsData?.fuelTypes?.find(
          (obj) => params.data?.fuelType === obj.fuelType
        )

        if (selectedFuelType) {
          const endUseTypes = selectedFuelType.eerRatios
            .filter(
              (item) =>
                item.fuelCategory.fuelCategory === params.data.fuelCategory
            )
            .map((item) => item.endUseType)

          // Set to null if multiple options, otherwise use first item
          const endUseValue =
            endUseTypes.length === 1 ? endUseTypes[0]?.type : null
          const provisionValue =
            selectedFuelType.provisions.length === 1
              ? selectedFuelType.provisions[0].name
              : null

          params.node.setDataValue('endUseType', endUseValue)
          params.node.setDataValue('provisionOfTheAct', provisionValue)
        }
      }

      const recalcFields = [
        'fuelTypeId',
        'fuelCategory',
        'provisionOfTheAct',
        'fuelCode',
        'exportDate'
      ]

      if (recalcFields.includes(params.column.getColId())) {
        // remove the stored value so the getter recalculates
        params.node.setDataValue('ciOfFuel', null)

        // refresh the CI columns for immediate feedback
        params.api.refreshCells({
          rowNodes: [params.node],
          columns: ['ciOfFuel', 'targetCi', 'uci', 'complianceUnits']
        })
      }
      params.api?.autoSizeAllColumns?.({ scaleUpToFitGridWidth: true })
    },
    [optionsData]
  )

  const onCellEditingStopped = useCallback(
    async (params: BCGridEditContext<BCGridRow>) => {
      if (!params.data) return
      if (params.oldValue === params.newValue) return

      params.node.updateData({
        ...(params.node.data ?? params.data),
        validationStatus: 'pending'
      })

      alertRef.current?.triggerAlert({
        message: 'Updating row...',
        severity: 'pending'
      })

      // clean up any null or empty string values
      const updatedData: BCGridRow = {}
      Object.entries(params.node.data ?? params.data).forEach(
        ([key, value]) => {
          if (value !== null && value !== '') updatedData[key] = value
        }
      )

      updatedData.compliancePeriod = compliancePeriod

      const savedData = await handleScheduleSave({
        alertRef,
        idField: 'fuelExportId',
        labelPrefix: 'fuelExport:fuelExportColLabels',
        params: {
          node: {
            data: params.data,
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
        },
        setErrors,
        setWarnings,
        saveRow,
        t,
        updatedData
      })

      const normalizedData: FuelExportRow = {
        ...savedData,
        fuelType:
          relationValue(savedData.fuelType, 'fuelType') ?? savedData.fuelType,
        fuelCategory:
          relationValue(savedData.fuelCategory, 'category') ??
          savedData.fuelCategory,
        provisionOfTheAct:
          relationValue(savedData.provisionOfTheAct, 'name') ??
          savedData.provisionOfTheAct,
        fuelCode:
          relationValue(savedData.fuelCode, 'fuelCode') ?? savedData.fuelCode,
        endUseType:
          relationValue(savedData.endUse, 'type') ?? savedData.endUseType
      }

      params.node.updateData(normalizedData)
    },
    [saveRow, t, compliancePeriod]
  )

  const onAction = async (action: string, params?: unknown) => {
    if (action !== 'delete' && action !== 'undo') return
    if (!isScheduleGridParams(params)) return
    await handleScheduleDelete(
      params,
      'fuelExportId',
      saveRow,
      alertRef,
      setRowData,
      {
        complianceReportId,
        compliancePeriod
      },
      'fuelTypeId' // First editable column for focus after clearing
    )
  }

  const handleNavigateBack = useCallback(() => {
    navigate(
      buildPath(ROUTES.REPORTS.VIEW, {
        compliancePeriod: compliancePeriod!,
        complianceReportId: complianceReportId!
      }),
      {
        state: {
          expandedSchedule: 'fuelExports',
          message: t('fuelExport:scheduleUpdated'),
          severity: 'success'
        }
      }
    )
  }, [navigate, compliancePeriod, complianceReportId, t])

  return (
    isFetched &&
    !fuelExportsLoading &&
    !isLoading && (
      <Grid2 className="add-edit-fuel-export-container" mx={-1}>
        <div className="header">
          <BCTypography variant="h5" color="primary">
            {t('fuelExport:addFuelExportRowsTitle')}
          </BCTypography>
          <BCTypography variant="body4" color="text" my={2} component="div">
            {t('fuelExport:fuelExportGuide')}
          </BCTypography>
        </div>
        <BCBox my={2} component="div" style={{ height: '100%', width: '100%' }}>
          <BCGridEditor
            gridRef={gridRef}
            alertRef={alertRef}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            rowData={rowData}
            gridOptions={gridOptions}
            loading={optionsLoading || fuelExportsLoading}
            onCellValueChanged={onCellValueChanged}
            onCellEditingStopped={onCellEditingStopped}
            showAddRowsButton={true}
            context={{ errors }}
            onAction={onAction}
            onFirstDataRendered={onFirstDataRendered}
            saveButtonProps={{
              enabled: true,
              text: t('report:saveReturn'),
              onSave: handleNavigateBack,
              confirmText: t('report:incompleteReport'),
              confirmLabel: t('report:returnToReport')
            }}
          />
        </BCBox>
      </Grid2>
    )
  )
}
