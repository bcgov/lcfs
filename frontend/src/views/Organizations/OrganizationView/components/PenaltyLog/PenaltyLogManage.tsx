import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Grid2 from '@mui/material/Grid2'
import { v4 as uuid } from 'uuid'
import type { AgGridReact } from 'ag-grid-react'
import type { GridOptions } from 'ag-grid-community'
import type {
  BCGridEditContext,
  BCGridRef,
  BCGridRow
} from '@/components/BCDataGrid/types'
import type { FloatingAlertHandle } from '@/components/BCAlert/FloatingAlert'

import BCBox from '@/components/BCBox'
import '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import '@/components/BCDataGrid/columns'
import '@/components/BCDataGrid/components/Renderers/RequiredHeader'

import {
  useOrganizationPenaltyLogs,
  useSaveOrganizationPenaltyLog,
  type OrganizationPenaltyLog,
  type OrganizationPenaltyLogPagination
} from '@/hooks/useOrganization'
import { useCompliancePeriod } from '@/hooks/useComplianceReports'
import { defaultInitialPagination } from '@/constants/schedules'
import { ROUTES, buildPath } from '@/routes/routes'
import { handleScheduleDelete } from '@/utils/schedules'
import { penaltyLogEditorColDefs, PENALTY_TYPES } from './_schema'
import type { ScheduleGridParams, ScheduleRow } from '@/utils/schedules'

interface PenaltyLogEditorRow extends ScheduleRow {
  id: string | number
  penaltyLogId?: number | string | null
  compliancePeriodId?: number | null
  complianceYear?: number | string | null
  contraventionType?: string | null
  offenceHistory: boolean
  deliberate: boolean
  effortsToCorrect: boolean
  economicBenefitDerived: boolean
  effortsToPreventRecurrence: boolean
  notes?: string
  penaltyAmount: number | null
  modified: boolean
  deleted?: boolean
}

interface PenaltyLogPayload extends Record<string, unknown> {
  penaltyLogId?: number | string | null
  compliancePeriodId?: number | null
  contraventionType?: string | null
  offenceHistory: boolean
  deliberate: boolean
  effortsToCorrect: boolean
  economicBenefitDerived: boolean
  effortsToPreventRecurrence: boolean
  notes?: string
  penaltyAmount: number | null
}

const mapApiPenaltyToRow = (
  penalty: OrganizationPenaltyLog,
  existingId?: string | number
): PenaltyLogEditorRow => ({
  id: existingId ?? penalty.penaltyLogId ?? uuid(),
  penaltyLogId: penalty.penaltyLogId,
  compliancePeriodId: penalty.compliancePeriodId,
  complianceYear: penalty.complianceYear,
  contraventionType: penalty.contraventionType,
  offenceHistory: !!penalty.offenceHistory,
  deliberate: !!penalty.deliberate,
  effortsToCorrect: !!penalty.effortsToCorrect,
  economicBenefitDerived: !!penalty.economicBenefitDerived,
  effortsToPreventRecurrence: !!penalty.effortsToPreventRecurrence,
  notes: penalty.notes ?? '',
  penaltyAmount:
    penalty.penaltyAmount === null || penalty.penaltyAmount === undefined
      ? null
      : Number(penalty.penaltyAmount),
  modified: false,
  validationStatus: 'success'
})

const buildPayloadFromRow = (data: PenaltyLogEditorRow): PenaltyLogPayload => ({
  penaltyLogId: data.penaltyLogId,
  compliancePeriodId: data.compliancePeriodId,
  contraventionType: data.contraventionType,
  offenceHistory: !!data.offenceHistory,
  deliberate: !!data.deliberate,
  effortsToCorrect: !!data.effortsToCorrect,
  economicBenefitDerived: !!data.economicBenefitDerived,
  effortsToPreventRecurrence: !!data.effortsToPreventRecurrence,
  notes: data.notes,
  penaltyAmount:
    data.penaltyAmount === null || data.penaltyAmount === undefined
      ? null
      : Number(data.penaltyAmount)
})

export const PenaltyLogManage = () => {
  const { t } = useTranslation(['org', 'common'])
  const navigate = useNavigate()
  const { orgID } = useParams()
  const alertRef = useRef<FloatingAlertHandle | null>(null)
  const gridRef = useRef<AgGridReact<BCGridRow> | null>(null) as BCGridRef

  const [rowData, setRowData] = useState<PenaltyLogEditorRow[]>([])

  const listPagination = useMemo<OrganizationPenaltyLogPagination>(
    () => ({ ...defaultInitialPagination, size: 500 }),
    []
  )

  const { data: compliancePeriods, isLoading: compliancePeriodsLoading } =
    useCompliancePeriod()

  const {
    data: penaltyLogsData,
    isLoading: penaltyLogsLoading,
    refetch: refetchPenaltyLogs
  } = useOrganizationPenaltyLogs(orgID, listPagination, {
    enabled: !!orgID
  })

  const { mutateAsync: savePenaltyLog } = useSaveOrganizationPenaltyLog(orgID)

  const compliancePeriodOptions = useMemo(() => {
    if (!compliancePeriods) return []
    const periods = Array.isArray(compliancePeriods)
      ? compliancePeriods
      : compliancePeriods.data
    const currentYear = new Date().getFullYear()

    // Filter out future years and map to options
    return periods
      .filter((period) => {
        const description = period.description || ''
        // Extract year from description (e.g., "2024" from "2024 Compliance Period")
        const yearMatch = description.match(/(\d{4})/)
        if (yearMatch) {
          const year = parseInt(yearMatch[1], 10)
          return year <= currentYear
        }
        // If we can't extract a year, include it to be safe
        return true
      })
      .map((period) => ({
        value: period.compliancePeriodId ?? period.compliance_period_id,
        label: period.description ?? ''
      }))
  }, [compliancePeriods])

  const compliancePeriodLabelMap = useMemo(() => {
    return new Map(
      compliancePeriodOptions.map((option) => [option.value, option.label])
    )
  }, [compliancePeriodOptions])

  const defaultColDef = useMemo(
    () => ({
      editable: true,
      resizable: true,
      filter: false,
      floatingFilter: false,
      sortable: false,
      singleClickEdit: true
    }),
    []
  )

  const gridOptions = useMemo<GridOptions<BCGridRow>>(
    () => ({
      autoSizeStrategy: {
        type: 'fitCellContents',
        defaultMinWidth: 80,
        defaultMaxWidth: 420
      }
    }),
    []
  )

  const columnDefs = useMemo(() => {
    const complianceValues = compliancePeriodOptions.map((option) =>
      option.value.toString()
    )

    return penaltyLogEditorColDefs(
      compliancePeriodLabelMap,
      complianceValues,
      t
    )
  }, [compliancePeriodLabelMap, compliancePeriodOptions, t])

  const onAddRows = useCallback((numRows = 1) => {
    return Array(numRows)
      .fill(null)
      .map(() => ({
        id: uuid(),
        penaltyLogId: null,
        compliancePeriodId: null,
        contraventionType: PENALTY_TYPES[0],
        offenceHistory: false,
        deliberate: false,
        effortsToCorrect: false,
        economicBenefitDerived: false,
        effortsToPreventRecurrence: false,
        notes: '',
        penaltyAmount: null,
        validationStatus: 'error',
        modified: true
      }))
  }, [])

  useEffect(() => {
    if (!penaltyLogsData) return

    const entries = penaltyLogsData.penaltyLogs?.length
      ? penaltyLogsData.penaltyLogs.map((penalty) =>
          mapApiPenaltyToRow(penalty)
        )
      : onAddRows()

    setRowData(entries)
  }, [penaltyLogsData, onAddRows])

  const onAction = useCallback(
    async (action: string, params?: unknown) => {
      if (action !== 'delete') return

      const defaultRow = {
        penaltyLogId: null,
        compliancePeriodId: null,
        contraventionType: PENALTY_TYPES[0]
      }

      const success = await handleScheduleDelete<PenaltyLogEditorRow>(
        params as ScheduleGridParams<PenaltyLogEditorRow>,
        'penaltyLogId',
        savePenaltyLog,
        alertRef,
        setRowData,
        defaultRow,
        'compliancePeriodId' // First editable column for focus after clearing
      )

      if (success) {
        await refetchPenaltyLogs()
      }
    },
    [savePenaltyLog, refetchPenaltyLogs]
  )

  const onCellEditingStopped = useCallback(
    async (params: BCGridEditContext<BCGridRow>) => {
      if (!params.data || !params.node.data) return
      const row = params.data as PenaltyLogEditorRow
      const nodeRow = params.node.data as PenaltyLogEditorRow
      if (!row.modified || row.deleted) return

      const payload = buildPayloadFromRow(nodeRow)

      if (payload.penaltyAmount === null || payload.penaltyAmount <= 0) {
        alertRef.current?.triggerAlert({
          severity: 'error',
          message: t('org:penaltyLog.messages.penaltyAmountRequired', {
            defaultValue: 'Penalty amount must be greater than zero.'
          })
        })
        params.node.updateData({
          ...nodeRow,
          validationStatus: 'error',
          modified: true
        })
        return
      }

      try {
        alertRef.current?.triggerAlert({
          severity: 'pending',
          message: t('org:penaltyLog.messages.saving', {
            defaultValue: 'Saving penalty log entry...'
          })
        })

        const response = await savePenaltyLog(payload)
        const savedPenalty = (response.data ??
          response) as OrganizationPenaltyLog
        const updatedRow = mapApiPenaltyToRow(savedPenalty, nodeRow.id)
        params.node.updateData(updatedRow)
        setRowData((prevRows) =>
          prevRows.map((row) =>
            row.id === updatedRow.id ? { ...updatedRow } : row
          )
        )
        alertRef.current?.triggerAlert({
          severity: 'success',
          message: t('org:penaltyLog.messages.saveSuccess', {
            defaultValue: 'Penalty log entry saved.'
          })
        })
        await refetchPenaltyLogs()
      } catch (error) {
        const failure = error as {
          response?: { data?: { detail?: string } }
          message?: string
        }
        const message =
          failure?.response?.data?.detail || failure?.message || 'Save failed.'
        alertRef.current?.triggerAlert({
          severity: 'error',
          message
        })
        params.node.updateData({
          ...nodeRow,
          validationStatus: 'error',
          modified: true
        })
      }
    },
    [refetchPenaltyLogs, savePenaltyLog, t]
  )

  useCallback(() => {
    navigate(
      buildPath(ROUTES.ORGANIZATIONS.PENALTY_LOG, { orgID: String(orgID) })
    )
  }, [navigate, orgID])

  if (compliancePeriodsLoading || penaltyLogsLoading) {
    return <Loading />
  }

  return (
    <Grid2
      className="penalty-log-manage"
      px={1}
      py={2}
      container
      direction="column"
    >
      <BCTypography variant="h5" color="primary">
        {t('org:penaltyLog.manageTitle', {
          defaultValue: 'Manage penalty log entries'
        })}
      </BCTypography>

      <BCBox component="div" sx={{ width: '100%', height: '100%' }}>
        <BCGridEditor
          gridRef={gridRef}
          alertRef={alertRef}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowData={rowData}
          onCellEditingStopped={onCellEditingStopped}
          onAction={onAction}
          gridOptions={gridOptions}
          loading={penaltyLogsLoading}
          stopEditingWhenCellsLoseFocus
          saveButtonProps={{
            enabled: true,
            text: t('org:penaltyLog.saveReturn'),
            onSave: () =>
              navigate(
                ROUTES.ORGANIZATIONS.PENALTY_LOG.replace(
                  ':orgID',
                  String(orgID)
                )
              )
          }}
        />
      </BCBox>
    </Grid2>
  )
}

export default PenaltyLogManage
