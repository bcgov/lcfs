import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import { BCAlert2 } from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import Loading from '@/components/Loading'
import { defaultColDef, notionalTransferColDefs } from './_schema'
import {
  useNotionalTransferOptions,
  useGetAllNotionalTransfers,
  useSaveNotionalTransfer
} from '@/hooks/useNotionalTransfer'
import { v4 as uuid } from 'uuid'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import { useApiService } from '@/services/useApiService'
import { apiRoutes } from '@/constants/routes'

export const AddEditNotionalTransfers = () => {
  const [rowData, setRowData] = useState([])
  const [errors, setErrors] = useState({})
  const [columnDefs, setColumnDefs] = useState([])

  const gridRef = useRef(null)
  const alertRef = useRef()
  const location = useLocation()
  const apiService = useApiService()
  const { t } = useTranslation(['common', 'notionalTransfer'])
  const { complianceReportId } = useParams()
  const {
    data: optionsData,
    isLoading: optionsLoading,
    isFetched
  } = useNotionalTransferOptions()
  const { data: notionalTransfers, isLoading: transfersLoading } =
    useGetAllNotionalTransfers(complianceReportId)
  const { mutateAsync: saveRow } = useSaveNotionalTransfer()

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('notionalTransfer:noNotionalTransfersFound'),
      autoSizeStrategy: {
        type: 'fitCellContents',
        defaultMinWidth: 50,
        defaultMaxWidth: 600
      }
    }),
    [t]
  )

  useEffect(() => {
    if (location.state?.message) {
      alertRef.triggerAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
    }
  }, [location.state])

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
        setRowData(ensureRowIds(notionalTransfers))
      } catch (error) {
        alertRef.triggerAlert({
          message: t('notionalTransfer:LoadFailMsg'),
          severity: 'error'
        })
      }
    } else {
      const id = uuid()
      const emptyRow = { id, complianceReportId }
      setRowData([emptyRow])
    }

    params.api.sizeColumnsToFit()
  }

  const onCellEditingStopped = useCallback(
    async (params) => {
      if (params.oldValue === params.newValue) return

      // Initialize updated data with 'pending' status
      params.node.updateData({
        ...params.node.data,
        complianceReportId,
        validationStatus: 'pending'
      })

      if (params.column.colId === 'legalName') {
        const newLegalName = params.newValue
        if (newLegalName) {
          let address = params.node.data.addressForService
          try {
            const response = await apiService.get(apiRoutes.organizationSearch, {
              params: { company: newLegalName }
            })
            const organizations = response.data
            const matchedOrg = organizations.find(org => org.name === newLegalName)
            if (matchedOrg && matchedOrg.formattedAddress) {
              address = matchedOrg.formattedAddress
            } else {
              console.log('No matching organization or address found')
            }
          } catch (error) {
            console.error('Error fetching organization details:', error)
          }
  
          // Add the new legal name and updated address (if found) to updatedData
          params.node.updateData({
            ...params.node.data,
            complianceReportId,
            legalName: newLegalName,
            addressForService: address
          })
        }
      }
  
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

      try {
        setErrors({})
        await saveRow(updatedData)
        updatedData = {
          ...updatedData,
          complianceReportId,
          validationStatus: 'success',
          modified: false
        }
        alertRef.current?.triggerAlert({
          message: 'Row updated successfully.',
          severity: 'success'
        })
      } catch (error) {
        const errArr = {
          [params.node.data.id]: error.response?.data?.detail?.map(
            (err) => err.loc[1]
          )
        }
        setErrors(errArr)

        updatedData = {
          ...updatedData,
          complianceReportId,
          validationStatus: 'error'
        }

        if (error.code === 'ERR_BAD_REQUEST') {
          const field = error.response?.data?.detail[0]?.loc[1]
            ? t(
                `notionalTransfer:notionalTransferColLabels.${error.response?.data?.detail[0]?.loc[1]}`
              )
            : ''
          const errMsg = `Error updating row: ${field} ${error.response?.data?.detail[0]?.msg}`

          alertRef.current?.triggerAlert({
            message: errMsg,
            severity: 'error'
          })
        } else {
          alertRef.current?.triggerAlert({
            message: `Error updating row: ${error.message}`,
            severity: 'error'
          })
        }
      }

      params.node.updateData(updatedData)
    },
    [saveRow, t, apiService, complianceReportId]
  )

  const onAction = async (action, params) => {
    if (action === 'delete') {
      const updatedRow = { ...params.node.data, deleted: true }

      params.api.applyTransaction({ remove: [params.node.data] })
      if (updatedRow.notionalTransferId) {
        try {
          await saveRow(updatedRow)
          alertRef.current?.triggerAlert({
            message: 'Row deleted successfully.',
            severity: 'success'
          })
        } catch (error) {
          alertRef.current?.triggerAlert({
            message: `Error deleting row: ${error.message}`,
            severity: 'error'
          })
        }
      }
    }
    if (action === 'duplicate') {
      const newRowID = uuid()
      const rowData = {
        ...params.node.data,
        id: newRowID,
        notionalTransferId: null,
        notionalTransfer: null,
        validationStatus: 'error',
        modified: true
      }

      params.api.applyTransaction({
        add: [rowData],
        addIndex: params.node?.rowIndex + 1
      })

      setErrors({ [newRowID]: 'notionalTransfer' })

      alertRef.current?.triggerAlert({
        message: 'Error updating row: Fuel supply equipment Fields required',
        severity: 'error'
      })
    }
  }

  useEffect(() => {
    if (!optionsLoading) {
      const updatedColumnDefs = notionalTransferColDefs(optionsData, errors)
      setColumnDefs(updatedColumnDefs)
    }
  }, [errors, optionsData, optionsLoading])

  if (optionsLoading || transfersLoading) {
    return <Loading />
  }

  return (
    isFetched &&
    !transfersLoading && (
      <Grid2 className="add-edit-notional-transfer-container" mx={-1}>
        <BCAlert2 ref={alertRef} data-test="alert-box" />
        <div className="header">
          <Typography variant="h5" color="primary">
            {t('notionalTransfer:newNotionalTransferTitle')}
          </Typography>
        </div>
        <BCBox my={2} component="div" style={{ height: '100%', width: '100%' }}>
          <BCGridEditor
            gridRef={gridRef}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            rowData={rowData}
            gridOptions={gridOptions}
            loading={optionsLoading || transfersLoading}
            onCellEditingStopped={onCellEditingStopped}
            onAction={onAction}
            showAddRowsButton={true}
            stopEditingWhenCellsLoseFocus
          />
        </BCBox>
      </Grid2>
    )
  )
}
