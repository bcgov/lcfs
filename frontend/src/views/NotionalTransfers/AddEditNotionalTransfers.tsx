import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { ROUTES, buildPath } from '@/routes/routes'
import {
  useGetAllNotionalTransfersList,
  useNotionalTransferOptions,
  useSaveNotionalTransfer
} from '@/hooks/useNotionalTransfer'
import { isArrayEmpty } from '@/utils/array'
import { handleScheduleDelete, handleScheduleSave } from '@/utils/schedules'
import Grid2 from '@mui/material/Grid2'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import {
  defaultColDef,
  notionalTransferColDefs,
  type NotionalTransferOptionsData
} from './_schema'
import { NEW_REGULATION_YEAR, REPORT_SCHEDULES } from '@/constants/common'
import { useComplianceReportWithCache } from '@/hooks/useComplianceReports'
import type { ColDef, GridReadyEvent } from 'ag-grid-community'
import type { AgGridReact } from 'ag-grid-react'
import type { MutableRefObject } from 'react'
import type { FloatingAlertHandle } from '@/components/BCAlert/FloatingAlert'
import type { AlertSeverity } from '@/components/BCAlert/BCAlertRoot'
import type {
  BCGridEditContext,
  BCGridRow
} from '@/components/BCDataGrid/types'
import type { GridErrors, GridWarnings } from '@/types/schema'
import type {
  ScheduleGridParams,
  ScheduleRow,
  ScheduleSaveParams
} from '@/utils/schedules'

interface NotionalTransferRow extends ScheduleRow {
  complianceReportId?: string | number
  compliancePeriod?: string
  notionalTransferId?: number | string
  legalName?: string
  id?: string | number
  quantity?: number
  fuelCategory?: string
  isNewSupplementalEntry?: boolean
}

const isOptionsData = (value: unknown): value is NotionalTransferOptionsData =>
  typeof value === 'object' &&
  value !== null &&
  'fuelCategories' in value &&
  Array.isArray(value.fuelCategories) &&
  'receivedOrTransferred' in value &&
  Array.isArray(value.receivedOrTransferred)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const getAlertSeverity = (value: unknown): AlertSeverity =>
  value === 'success' ||
  value === 'warning' ||
  value === 'error' ||
  value === 'pending'
    ? value
    : 'info'

const isNotionalTransferRows = (
  value: unknown
): value is NotionalTransferRow[] =>
  Array.isArray(value) &&
  value.every((row) => typeof row === 'object' && row !== null)

const isNotionalTransferRow = (value: unknown): value is NotionalTransferRow =>
  typeof value === 'object' && value !== null

const isScheduleGridParams = (
  value: unknown
): value is ScheduleGridParams<NotionalTransferRow> => {
  if (typeof value !== 'object' || value === null || !('node' in value)) {
    return false
  }
  const params = value as { node?: unknown; api?: unknown }
  return (
    typeof params.node === 'object' &&
    params.node !== null &&
    typeof params.api === 'object' &&
    params.api !== null
  )
}

export const AddEditNotionalTransfers = () => {
  const [rowData, setRowData] = useState<NotionalTransferRow[]>([])
  const [errors, setErrors] = useState<GridErrors>({})
  const [warnings, setWarnings] = useState<GridWarnings>({})
  const [columnDefs, setColumnDefs] = useState<ColDef[]>([])

  const gridRef = useRef<AgGridReact<NotionalTransferRow> | null>(null)
  const alertRef = useRef<FloatingAlertHandle | null>(null)
  const location = useLocation()
  const locationState = isRecord(location.state) ? location.state : undefined
  const { t } = useTranslation(['common', 'notionalTransfer', 'reports'])
  const { complianceReportId, compliancePeriod } = useParams<{
    complianceReportId: string
    compliancePeriod: string
  }>()
  const {
    data: optionsData,
    isLoading: optionsLoading,
    isFetched
  } = useNotionalTransferOptions({})
  const { mutateAsync: saveRow } = useSaveNotionalTransfer(complianceReportId)
  const navigate = useNavigate()
  const { data: currentReport, isLoading } = useComplianceReportWithCache(
    complianceReportId!
  )
  const organization = currentReport?.report.organization
  const orgName =
    isRecord(organization) && typeof organization.name === 'string'
      ? organization.name
      : undefined

  const isSupplemental = currentReport?.report?.version !== 0
  const isEarlyIssuance =
    currentReport?.report?.reportingFrequency === REPORT_SCHEDULES.QUARTERLY

  const { data: notionalTransfers, isLoading: transfersLoading } =
    useGetAllNotionalTransfersList({
      complianceReportId,
      changelog: isSupplemental
    })

  useEffect(() => {
    if (locationState?.message && typeof locationState.message === 'string') {
      alertRef.current?.triggerAlert({
        message: locationState.message,
        severity: getAlertSeverity(locationState.severity)
      })
    }
  }, [locationState?.message, locationState?.severity])

  const validate = (
    params: BCGridEditContext<BCGridRow>,
    validationFn: (value: unknown) => boolean,
    errorMessage: string,
    targetAlertRef: MutableRefObject<FloatingAlertHandle | null>,
    field?: string
  ) => {
    const value = field ? params.node?.data?.[field] : params

    if (field && params.colDef?.field !== field) {
      return true
    }

    if (!validationFn(value)) {
      targetAlertRef.current?.triggerAlert({
        message: errorMessage,
        severity: 'error'
      })
      return false
    }
    return true // Proceed with the update
  }

  const onGridReady = useCallback(
    (params: GridReadyEvent<BCGridRow>) => {
      const ensureRowIds = (rows: NotionalTransferRow[]) => {
        return rows.map((row) => {
          if (!row.id) {
            return {
              ...row,
              complianceReportId,
              isNewSupplementalEntry:
                isSupplemental &&
                row.complianceReportId === Number(complianceReportId),
              id: uuid(),
              isValid: false
            }
          }
          return row
        })
      }

      const transfers = isNotionalTransferRows(notionalTransfers)
        ? notionalTransfers
        : []
      if (transfers.length > 0) {
        try {
          setRowData([
            ...ensureRowIds(transfers),
            {
              id: uuid(),
              complianceReportId
            }
          ])
        } catch {
          alertRef.current?.triggerAlert({
            message: t('notionalTransfer:LoadFailMsg'),
            severity: 'error'
          })
        }
      } else {
        setRowData([{ id: uuid(), complianceReportId }])
      }

      setTimeout(() => {
        const lastRowIndex = params.api.getLastDisplayedRowIndex()
        params.api.startEditingCell({
          rowIndex: lastRowIndex,
          colKey: 'legalName'
        })
      }, 100)
    },
    [complianceReportId, isSupplemental, notionalTransfers, t]
  )

  const onCellEditingStopped = useCallback(
    async (params: BCGridEditContext<BCGridRow>) => {
      if (params.oldValue === params.newValue) return

      // User cannot select their own organization as the transaction partner
      if (params.colDef?.field === 'legalName') {
        if (
          (isRecord(params.newValue) && params.newValue.name === orgName) ||
          params.newValue === orgName
        ) {
          alertRef.current?.triggerAlert({
            message:
              'You cannot select your own organization as the transaction partner.',
            severity: 'error'
          })
          params.node.setDataValue('legalName', '')
          return
        }

        const legalName =
          typeof params.newValue === 'string'
            ? params.newValue
            : isRecord(params.newValue) &&
                typeof params.newValue.name === 'string'
              ? params.newValue.name
              : ''

        params.node.setDataValue('legalName', legalName)
      }

      const isValid = validate(
        params,
        (value: unknown) => {
          return value !== null && !isNaN(Number(value)) && Number(value) > 0
        },
        'Quantity supplied must be greater than 0.',
        alertRef,
        'quantity'
      )

      if (!isValid) {
        return
      }

      // Initialize updated data with 'pending' status
      params.node.updateData({
        ...params.node.data,
        complianceReportId,
        validationStatus: 'pending'
      })

      alertRef.current?.triggerAlert({
        message: 'Updating row...',
        severity: 'pending'
      })

      // clean up any null or empty string values
      let updatedData = Object.entries(
        params.node.data ?? {}
      ).reduce<BCGridRow>((acc, [key, value]) => {
        if (value !== null && value !== '') acc[key] = value
        return acc
      }, {})

      updatedData = await handleScheduleSave({
        alertRef,
        idField: 'notionalTransferId',
        labelPrefix: 'notionalTransfer:notionalTransferColLabels',
        params: {
          node: {
            data: isNotionalTransferRow(params.node.data)
              ? params.node.data
              : {},
            updateData: (data) => params.node.updateData(data)
          },
          api: {
            forEachNode: (callback) =>
              params.api.forEachNode((node) => {
                if (isNotionalTransferRow(node.data)) {
                  callback({
                    data: node.data,
                    updateData: (data) => node.updateData(data)
                  })
                }
              })
          }
        } satisfies ScheduleSaveParams<NotionalTransferRow>,
        setErrors,
        setWarnings,
        saveRow,
        t,
        updatedData
      })

      params.node.updateData(updatedData)

      // Auto-resize columns after data update
      setTimeout(() => {
        params.api?.autoSizeAllColumns?.({ scaleUpToFitGridWidth: true })
      }, 0)
    },
    [saveRow, t, complianceReportId, orgName]
  )

  const onAction = async (action: string, params?: unknown) => {
    if (action === 'delete' || action === 'undo') {
      if (!isScheduleGridParams(params)) return
      await handleScheduleDelete(
        params,
        'notionalTransferId',
        saveRow,
        alertRef,
        (rows) => {
          if (isNotionalTransferRows(rows)) setRowData(rows)
        },
        {
          complianceReportId
        },
        'legalName' // First editable column for focus after clearing
      )
    }
  }

  useEffect(() => {
    if (
      !optionsLoading &&
      isOptionsData(optionsData) &&
      !isArrayEmpty(optionsData)
    ) {
      setColumnDefs(
        notionalTransferColDefs(
          optionsData,
          orgName!,
          errors,
          warnings,
          isSupplemental,
          compliancePeriod!,
          isEarlyIssuance
        )
      )
    }
  }, [
    isSupplemental,
    isEarlyIssuance,
    errors,
    optionsData,
    warnings,
    orgName,
    compliancePeriod,
    optionsLoading
  ])

  useEffect(() => {
    if (!transfersLoading && !isArrayEmpty(notionalTransfers)) {
      const transfers = isNotionalTransferRows(notionalTransfers)
        ? notionalTransfers
        : []
      setRowData((currentRowData) => {
        const updatedRowData =
          transfers.map((item) => {
            let matchingRow = currentRowData.find(
              (row) => row.notionalTransferId === item.notionalTransferId
            )
            if (!matchingRow) {
              matchingRow = currentRowData.find(
                (row) =>
                  row.notionalTransferId === undefined ||
                  row.notionalTransferId === null
              )
            }
            return {
              ...item,
              complianceReportId,
              isNewSupplementalEntry:
                isSupplemental &&
                item.complianceReportId === Number(complianceReportId),
              id: matchingRow ? matchingRow.id : uuid()
            }
          }) ?? []
        return [
          ...updatedRowData,
          { id: uuid(), complianceReportId, compliancePeriod }
        ]
      })
    } else {
      setRowData([{ id: uuid(), complianceReportId, compliancePeriod }])
    }
  }, [
    compliancePeriod,
    complianceReportId,
    isSupplemental,
    notionalTransfers,
    transfersLoading
  ])

  const updateGridColumnsVisibility = useCallback(() => {
    if (!gridRef.current?.api) return
    const api = gridRef.current.api
    const complianceYear = parseInt(compliancePeriod ?? '', 10)
    // These columns only apply for compliance years >= 2025
    if (Number.isNaN(complianceYear) || complianceYear < NEW_REGULATION_YEAR) {
      api.setColumnsVisible(['isCanadaProduced'], false)
      api.setColumnsVisible(['isQ1Supplied'], false)
      return
    }
    let showColumns = false
    api.forEachNode((node) => {
      if (node.data?.fuelCategory === 'Diesel') {
        showColumns = true
      }
    })
    api.setColumnsVisible(['isCanadaProduced'], showColumns)
    // Q1 supplied only applies to the 2025 transition year
    api.setColumnsVisible(
      ['isQ1Supplied'],
      showColumns && complianceYear === NEW_REGULATION_YEAR
    )
    if (showColumns) {
      api?.autoSizeAllColumns?.()
    }
  }, [compliancePeriod])

  // Preserve the original row-data/options-only effect trigger.
  const previousGridColumnsEffectInputsRef = useRef({ rowData, optionsData })
  const updateGridColumnsVisibilityForEffectRef = useRef(
    updateGridColumnsVisibility
  )
  if (
    previousGridColumnsEffectInputsRef.current.rowData !== rowData ||
    previousGridColumnsEffectInputsRef.current.optionsData !== optionsData
  ) {
    previousGridColumnsEffectInputsRef.current = { rowData, optionsData }
    updateGridColumnsVisibilityForEffectRef.current =
      updateGridColumnsVisibility
  }

  const onFirstDataRendered = useCallback(
    (params: import('ag-grid-community').FirstDataRenderedEvent<BCGridRow>) => {
      params.api?.autoSizeAllColumns?.({ scaleUpToFitGridWidth: true })
    },
    []
  )
  const onCellValueChanged = useCallback(async () => {
    setTimeout(() => {
      updateGridColumnsVisibility()
    }, 0)
  }, [updateGridColumnsVisibility])
  useEffect(() => {
    updateGridColumnsVisibilityForEffectRef.current()
  }, [rowData, optionsData])

  const handleNavigateBack = useCallback(() => {
    navigate(
      buildPath(ROUTES.REPORTS.VIEW, {
        compliancePeriod: compliancePeriod!,
        complianceReportId: complianceReportId!
      }),
      {
        state: {
          expandedSchedule: 'notionalTransfers',
          message: t('notionalTransfer:scheduleUpdated'),
          severity: 'success'
        }
      }
    )
  }, [navigate, compliancePeriod, complianceReportId, t])

  if (optionsLoading || transfersLoading) {
    return <Loading />
  }

  return (
    isFetched &&
    !transfersLoading &&
    !isLoading && (
      <Grid2 className="add-edit-notional-transfer-container" mx={-1}>
        <div className="header">
          <BCTypography variant="h5" color="primary">
            {t('notionalTransfer:newNotionalTransferTitle')}
          </BCTypography>
          <BCTypography variant="body4" color="text" my={2} component="div">
            {t('notionalTransfer:newNotionalTransferGuide')}
          </BCTypography>
        </div>
        <BCBox my={2} component="div" style={{ height: '100%', width: '100%' }}>
          <BCGridEditor
            gridRef={gridRef}
            alertRef={alertRef}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            onFirstDataRendered={onFirstDataRendered}
            rowData={rowData}
            overlayNoRowsTemplate={t(
              'notionalTransfer:noNotionalTransfersFound'
            )}
            loading={optionsLoading || transfersLoading}
            onCellValueChanged={onCellValueChanged}
            onCellEditingStopped={onCellEditingStopped}
            onAction={onAction}
            autoSizeStrategy={{
              type: 'fitCellContents',
              defaultMinWidth: 80,
              defaultMaxWidth: 800,
              scaleUpToFitGridWidth: true
            }}
            showAddRowsButton={true}
            stopEditingWhenCellsLoseFocus
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
