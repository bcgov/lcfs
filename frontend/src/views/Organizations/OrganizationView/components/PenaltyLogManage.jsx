import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Grid2 from '@mui/material/Grid2'
import { v4 as uuid } from 'uuid'

import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import { validation, actions } from '@/components/BCDataGrid/columns'
import { RequiredHeader } from '@/components/BCDataGrid/components'

import {
  useOrganizationPenaltyLogs,
  useSaveOrganizationPenaltyLog
} from '@/hooks/useOrganization'
import { useCompliancePeriod } from '@/hooks/useComplianceReports'
import { defaultInitialPagination } from '@/constants/schedules'
import { ROUTES, buildPath } from '@/routes/routes'
import { handleScheduleDelete } from '@/utils/schedules'

const PENALTY_TYPES = [
  'Single contravention',
  'Continuous contravention'
]

const booleanValueSetter = (field) => (params) => {
  const { newValue } = params
  if (newValue === undefined || newValue === null || newValue === '') {
    params.data[field] = false
    return true
  }
  if (typeof newValue === 'boolean') {
    params.data[field] = newValue
    return true
  }
  params.data[field] =
    newValue === 'Yes' || newValue === 'true' || newValue === 'True'
  return true
}

const mapApiPenaltyToRow = (penalty, existingId) => ({
  id: existingId ?? penalty.penaltyLogId ?? uuid(),
  penaltyLogId: penalty.penaltyLogId,
  compliancePeriodId: penalty.compliancePeriodId,
  complianceYear: penalty.complianceYear,
  penaltyType: penalty.penaltyType,
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

const buildPayloadFromRow = (data) => ({
  penaltyLogId: data.penaltyLogId,
  compliancePeriodId: data.compliancePeriodId,
  penaltyType: data.penaltyType,
  offenceHistory: !!data.offenceHistory,
  deliberate: !!data.deliberate,
  effortsToCorrect: !!data.effortsToCorrect,
  economicBenefitDerived: !!data.economicBenefitDerived,
  effortsToPreventRecurrence: !!data.effortsToPreventRecurrence,
  notes: data.notes,
  penaltyAmount:
    data.penaltyAmount === null || data.penaltyAmount === undefined
      ? 0
      : Number(data.penaltyAmount)
})

export const PenaltyLogManage = () => {
  const { t } = useTranslation(['org', 'common'])
  const navigate = useNavigate()
  const { orgID } = useParams()
  const alertRef = useRef(null)
  const gridRef = useRef(null)

  const [rowData, setRowData] = useState([])

  const listPagination = useMemo(
    () => ({ ...defaultInitialPagination, size: 500 }),
    []
  )

  const {
    data: compliancePeriods,
    isLoading: compliancePeriodsLoading
  } = useCompliancePeriod()

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
    return compliancePeriods.map((period) => ({
      value: period.compliancePeriodId ?? period.compliance_period_id,
      label: period.description
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
      sortable: true,
      filter: true,
      floatingFilter: true,
      suppressHeaderMenuButton: true
    }),
    []
  )

  const gridOptions = useMemo(
    () => ({
      stopEditingWhenCellsLoseFocus: false,
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

    return [
      validation,
      actions((params) => ({
        enableDuplicate: false,
        enableUndo: false,
        enableStatus: false,
        enableDelete: !!params.data.penaltyLogId
      })),
      {
        field: 'id',
        hide: true
      },
      {
        field: 'penaltyLogId',
        hide: true
      },
      {
        field: 'compliancePeriodId',
        headerComponent: RequiredHeader,
        headerName: t('org:penaltyLog.columns.compliancePeriod', {
          defaultValue: 'Compliance period'
        }),
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: complianceValues
        },
        valueFormatter: ({ value }) =>
          value !== undefined && value !== null
            ? compliancePeriodLabelMap.get(Number(value)) ?? ''
            : '',
        valueSetter: (params) => {
          if (params.newValue === undefined || params.newValue === null) {
            return false
          }
          const numericValue = Number(params.newValue)
          params.data.compliancePeriodId = numericValue
          params.data.complianceYear = compliancePeriodLabelMap.get(
            numericValue
          )
          return true
        },
        minWidth: 200
      },
      {
        field: 'penaltyType',
        headerComponent: RequiredHeader,
        headerName: t('org:penaltyLog.columns.penaltyType', {
          defaultValue: 'Contravention type'
        }),
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: PENALTY_TYPES
        },
        minWidth: 220
      },
      {
        field: 'penaltyAmount',
        headerComponent: RequiredHeader,
        headerName: t('org:penaltyLog.columns.penaltyAmount', {
          defaultValue: 'Penalty amount (CAD)'
        }),
        cellEditor: 'agNumberCellEditor',
        valueFormatter: ({ value }) =>
          value === null || value === undefined
            ? ''
            : Number(value).toLocaleString('en-CA', {
                style: 'currency',
                currency: 'CAD',
                maximumFractionDigits: 0
              }),
        minWidth: 200
      },
      {
        field: 'offenceHistory',
        headerName: t('org:penaltyLog.columns.offenceHistory', {
          defaultValue: 'History of offences'
        }),
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Yes', 'No']
        },
        valueFormatter: ({ value }) => (value ? 'Yes' : 'No'),
        valueSetter: booleanValueSetter('offenceHistory'),
        minWidth: 190
      },
      {
        field: 'deliberate',
        headerName: t('org:penaltyLog.columns.deliberate', {
          defaultValue: 'Deliberate contravention'
        }),
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Yes', 'No']
        },
        valueFormatter: ({ value }) => (value ? 'Yes' : 'No'),
        valueSetter: booleanValueSetter('deliberate'),
        minWidth: 210
      },
      {
        field: 'effortsToCorrect',
        headerName: t('org:penaltyLog.columns.effortsToCorrect', {
          defaultValue: 'Efforts to correct'
        }),
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Yes', 'No']
        },
        valueFormatter: ({ value }) => (value ? 'Yes' : 'No'),
        valueSetter: booleanValueSetter('effortsToCorrect'),
        minWidth: 180
      },
      {
        field: 'economicBenefitDerived',
        headerName: t('org:penaltyLog.columns.economicBenefitDerived', {
          defaultValue: 'Economic benefit derived'
        }),
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Yes', 'No']
        },
        valueFormatter: ({ value }) => (value ? 'Yes' : 'No'),
        valueSetter: booleanValueSetter('economicBenefitDerived'),
        minWidth: 220
      },
      {
        field: 'effortsToPreventRecurrence',
        headerName: t('org:penaltyLog.columns.effortsToPreventRecurrence', {
          defaultValue: 'Efforts to prevent recurrence'
        }),
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Yes', 'No']
        },
        valueFormatter: ({ value }) => (value ? 'Yes' : 'No'),
        valueSetter: booleanValueSetter('effortsToPreventRecurrence'),
        minWidth: 240
      },
      {
        field: 'notes',
        headerName: t('org:penaltyLog.columns.notes', {
          defaultValue: 'Notes'
        }),
        cellEditor: 'agLargeTextCellEditor',
        minWidth: 260
      }
    ]
  }, [compliancePeriodLabelMap, compliancePeriodOptions, t])

  useEffect(() => {
    if (penaltyLogsData?.penaltyLogs) {
      setRowData(
        penaltyLogsData.penaltyLogs.map((penalty) =>
          mapApiPenaltyToRow(penalty)
        )
      )
    }
  }, [penaltyLogsData])

  const onAddRows = useCallback((numRows = 1) => {
    return Array(numRows)
      .fill(null)
      .map(() => ({
        id: uuid(),
        penaltyLogId: null,
        compliancePeriodId: null,
        penaltyType: PENALTY_TYPES[0],
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

  const onAction = useCallback(
    async (action, params) => {
      if (action !== 'delete') return

      const defaultRow = {
        penaltyLogId: null,
        compliancePeriodId: null,
        penaltyType: PENALTY_TYPES[0]
      }

      const success = await handleScheduleDelete(
        params,
        'penaltyLogId',
        savePenaltyLog,
        alertRef,
        setRowData,
        defaultRow
      )

      if (success) {
        await refetchPenaltyLogs()
      }
    },
    [savePenaltyLog, refetchPenaltyLogs]
  )

  const onCellEditingStopped = useCallback(
    async (params) => {
      if (!params.data.modified || params.data.deleted) return

      const payload = buildPayloadFromRow(params.node.data)

      try {
        alertRef.current?.triggerAlert({
          severity: 'pending',
          message: t('org:penaltyLog.messages.saving', {
            defaultValue: 'Saving penalty log entry...'
          })
        })

        const response = await savePenaltyLog(payload)
        const savedPenalty = response.data ?? response
        const updatedRow = mapApiPenaltyToRow(
          savedPenalty,
          params.node.data.id
        )
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
        const message =
          error?.response?.data?.detail || error.message || 'Save failed.'
        alertRef.current?.triggerAlert({
          severity: 'error',
          message
        })
        params.node.updateData({
          ...params.node.data,
          validationStatus: 'error',
          modified: true
        })
      }
    },
    [refetchPenaltyLogs, savePenaltyLog, t]
  )

  const handleBack = useCallback(() => {
    navigate(
      buildPath(ROUTES.ORGANIZATIONS.PENALTY_LOG, {
        orgID
      })
    )
  }, [navigate, orgID])

  if (compliancePeriodsLoading || penaltyLogsLoading) {
    return <Loading />
  }

  return (
    <Grid2 className="penalty-log-manage" px={1} py={2} container direction="column">
      <Grid2 display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <BCTypography variant="h5" color="primary">
          {t('org:penaltyLog.manageTitle', {
            defaultValue: 'Manage penalty log entries'
          })}
        </BCTypography>
        <BCButton variant="outlined" color="primary" onClick={handleBack}>
          {t('common:backBtn', { defaultValue: 'Back' })}
        </BCButton>
      </Grid2>

      <BCBox component="div" sx={{ width: '100%', height: '100%' }}>
        <BCGridEditor
          gridRef={gridRef}
          alertRef={alertRef}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowData={rowData}
          onCellEditingStopped={onCellEditingStopped}
          onAction={onAction}
          onAddRows={onAddRows}
          gridOptions={gridOptions}
          loading={penaltyLogsLoading}
        />
      </BCBox>
    </Grid2>
  )
}

export default PenaltyLogManage
