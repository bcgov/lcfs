import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { ROUTES, buildPath } from '@/routes/routes'
import { useGetComplianceReport } from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useGetAllNotionalTransfersList,
  useNotionalTransferOptions,
  useSaveNotionalTransfer
} from '@/hooks/useNotionalTransfer'
import { isArrayEmpty } from '@/utils/array'
import { changelogRowStyle } from '@/utils/grid/changelogCellStyle'
import { handleScheduleDelete, handleScheduleSave } from '@/utils/schedules.js'
import Grid2 from '@mui/material/Grid2'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { defaultColDef, notionalTransferColDefs } from './_schema'
import { REPORT_SCHEDULES } from '@/constants/common'

export const AddEditNotionalTransfers = () => {
  const [rowData, setRowData] = useState([])
  const [errors, setErrors] = useState({})
  const [warnings, setWarnings] = useState({})
  const [columnDefs, setColumnDefs] = useState([])

  const gridRef = useRef(null)
  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'notionalTransfer', 'reports'])
  const { complianceReportId, compliancePeriod } = useParams()
  const {
    data: optionsData,
    isLoading: optionsLoading,
    isFetched
  } = useNotionalTransferOptions()
  const { mutateAsync: saveRow } = useSaveNotionalTransfer(complianceReportId)
  const navigate = useNavigate()
  const { data: currentUser, isLoading: currentUserLoading } = useCurrentUser()
  const { data: complianceReport, isLoading: complianceReportLoading } =
    useGetComplianceReport(
      currentUser?.organization?.organizationId,
      complianceReportId,
      { enabled: !currentUserLoading }
    )

  const isSupplemental = complianceReport?.report?.version !== 0
  const isEarlyIssuance =
    complianceReport?.report?.reportingFrequency === REPORT_SCHEDULES.QUARTERLY

  const { data: notionalTransfers, isLoading: transfersLoading } =
    useGetAllNotionalTransfersList({
      complianceReportId,
      changelog: isSupplemental
    })

  useEffect(() => {
    if (location?.state?.message) {
      alertRef.triggerAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
    }
  }, [location?.state?.message, location?.state?.severity])

  const validate = (
    params,
    validationFn,
    errorMessage,
    alertRef,
    field = null
  ) => {
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
    return true // Proceed with the update
  }

  const onGridReady = useCallback(
    (params) => {
      const ensureRowIds = (rows) => {
        return rows.map((row) => {
          if (!row.id) {
            return {
              ...row,
              complianceReportId,
              isNewSupplementalEntry:
                isSupplemental &&
                row.complianceReportId === +complianceReportId,
              id: uuid(),
              isValid: false
            }
          }
          return row
        })
      }

      if (notionalTransfers && notionalTransfers.length > 0) {
        try {
          setRowData([
            ...ensureRowIds(notionalTransfers),
            {
              id: uuid(),
              complianceReportId
            }
          ])
        } catch (error) {
          alertRef.triggerAlert({
            message: t('notionalTransfer:LoadFailMsg'),
            severity: 'error'
          })
        }
      } else {
        setRowData([{ id: uuid(), complianceReportId }])
      }

      params.api.sizeColumnsToFit()

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
    async (params) => {
      if (params.oldValue === params.newValue) return

      // User cannot select their own organization as the transaction partner
      if (params.colDef.field === 'legalName') {
        const orgName = currentUser.organization?.name
        if (
          (typeof params.newValue === 'object' &&
            params.newValue?.name === orgName) ||
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
            : params.newValue?.name || ''

        params.node.setDataValue('legalName', legalName)
      }

      const isValid = validate(
        params,
        (value) => {
          return value !== null && !isNaN(value) && value > 0
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
      let updatedData = Object.entries(params.node.data)
        .filter(([, value]) => value !== null && value !== '')
        .reduce((acc, [key, value]) => {
          acc[key] = value
          return acc
        }, {})

      updatedData = await handleScheduleSave({
        alertRef,
        idField: 'notionalTransferId',
        labelPrefix: 'notionalTransfer:notionalTransferColLabels',
        params,
        setErrors,
        setWarnings,
        saveRow,
        t,
        updatedData
      })

      params.node.updateData(updatedData)
    },
    [saveRow, t, complianceReportId]
  )

  const onAction = async (action, params) => {
    if (action === 'delete' || action === 'undo') {
      await handleScheduleDelete(
        params,
        'notionalTransferId',
        saveRow,
        alertRef,
        setRowData,
        {
          complianceReportId
        }
      )
    }
  }

  useEffect(() => {
    if (!optionsLoading && !isArrayEmpty(optionsData)) {
      setColumnDefs(
        notionalTransferColDefs(
          optionsData,
          currentUser,
          errors,
          warnings,
          isSupplemental,
          compliancePeriod,
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
    currentUser,
    compliancePeriod
  ])

  useEffect(() => {
    if (!transfersLoading && !isArrayEmpty(notionalTransfers)) {
      const updatedRowData =
        notionalTransfers?.map((item) => {
          let matchingRow = rowData.find(
            (row) => row.notionalTransferId === item.notionalTransferId
          )
          if (!matchingRow) {
            matchingRow = rowData.find(
              (row) =>
                row.notionalTransferId === undefined ||
                row.notionalTransferId === null
            )
          }
          return {
            ...item,
            complianceReportId,
            isNewSupplementalEntry:
              isSupplemental && item.complianceReportId === +complianceReportId,
            id: matchingRow ? matchingRow.id : uuid()
          }
        }) ?? []
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
    isSupplemental,
    notionalTransfers,
    transfersLoading
  ])

  const handleNavigateBack = useCallback(() => {
    navigate(
      buildPath(ROUTES.REPORTS.VIEW, {
        compliancePeriod,
        complianceReportId
      })
    )
  }, [navigate, compliancePeriod, complianceReportId])

  if (optionsLoading || transfersLoading) {
    return <Loading />
  }

  return (
    isFetched &&
    !transfersLoading &&
    !currentUserLoading &&
    !complianceReportLoading && (
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
            rowData={rowData}
            overlayNoRowsTemplate={t(
              'notionalTransfer:noNotionalTransfersFound'
            )}
            loading={optionsLoading || transfersLoading}
            onCellEditingStopped={onCellEditingStopped}
            onAction={onAction}
            autoSizeStrategy={{
              type: 'fitGridWidth',
              defaultMinWidth: 50,
              defaultMaxWidth: 600
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
            gridOptions={{
              getRowStyle: (params) => changelogRowStyle(params, isSupplemental)
            }}
          />
        </BCBox>
      </Grid2>
    )
  )
}
