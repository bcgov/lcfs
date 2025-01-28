import { useState, useEffect, useRef, useCallback } from 'react'
import BCTypography from '@/components/BCTypography'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import BCBox from '@/components/BCBox'
import Loading from '@/components/Loading'
import { defaultColDef, notionalTransferColDefs } from './_schema'
import {
  useNotionalTransferOptions,
  useGetAllNotionalTransfers,
  useSaveNotionalTransfer
} from '@/hooks/useNotionalTransfer'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { v4 as uuid } from 'uuid'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import * as ROUTES from '@/constants/routes/routes.js'
import { handleScheduleDelete, handleScheduleSave } from '@/utils/schedules.js'

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
  const { data: notionalTransfers, isLoading: transfersLoading } =
    useGetAllNotionalTransfers(complianceReportId)
  const { mutateAsync: saveRow } = useSaveNotionalTransfer()
  const navigate = useNavigate()
  const { data: currentUser } = useCurrentUser()

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

  const onGridReady = (params) => {
    const ensureRowIds = (rows) => {
      return rows.map((row) => {
        if (!row.id) {
          return {
            ...row,
            complianceReportId,
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
  }

  const onCellEditingStopped = useCallback(
    async (params) => {
      if (params.oldValue === params.newValue) return

      // User cannot select their own organization as the transaction partner
      if (params.colDef.field === 'legalName') {
        if (params.newValue === currentUser.organization.name) {
          alertRef.current?.triggerAlert({
            message:
              'You cannot select your own organization as the transaction partner.',
            severity: 'error'
          })
          params.node.setDataValue('legalName', '')
          return
        }
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
    if (action === 'delete') {
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
    if (!optionsLoading) {
      const updatedColumnDefs = notionalTransferColDefs(
        optionsData,
        currentUser,
        errors,
        warnings
      )
      setColumnDefs(updatedColumnDefs)
    }
  }, [optionsData, currentUser, errors, warnings, optionsLoading])

  const handleNavigateBack = useCallback(() => {
    navigate(
      ROUTES.REPORTS_VIEW.replace(
        ':compliancePeriod',
        compliancePeriod
      ).replace(':complianceReportId', complianceReportId)
    )
  }, [navigate, compliancePeriod, complianceReportId])

  if (optionsLoading || transfersLoading) {
    return <Loading />
  }

  return (
    isFetched &&
    !transfersLoading && (
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
          />
        </BCBox>
      </Grid2>
    )
  )
}
