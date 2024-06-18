import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import BCAlert from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import BCBox from '@/components/BCBox'
import Loading from '@/components/Loading'
import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import BCDataGridEditor from '@/components/BCDataGrid/BCDataGridEditor'
import { defaultColDef, notionalTransferColDefs, notionalTransferSchema } from './_schema'
import { AddRowsButton } from './AddRowsButton'
import { useNotionalTransferOptions, useGetNotionalTransfers, useSaveNotionalTransfer } from '@/hooks/useNotionalTransfer'
import { v4 as uuid } from 'uuid'

export const AddEditNotionalTransfers = () => {
  const [rowData, setRowData] = useState([])
  const [gridApi, setGridApi] = useState(null)
  const [columnApi, setColumnApi] = useState(null)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

  const gridRef = useRef(null)
  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'notionalTransfer'])
  const { complianceReportId } = useParams()
  const { data: optionsData, isLoading: optionsLoading, isFetched } = useNotionalTransferOptions()
  const { data: notionalTransfers, isLoading: transfersLoading } = useGetNotionalTransfers(complianceReportId)
  const { mutate: saveRow } = useSaveNotionalTransfer()

  const gridKey = 'add-notional-transfer'
  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('notionalTransfer:noNotionalTransfersFound'),
      autoSizeStrategy: {
        type: 'fitCellContents',
        defaultMinWidth: 50,
        defaultMaxWidth: 600,
      },
    }),
    [t]
  )

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const onGridReady = (params) => {
    setGridApi(params.api)
    setColumnApi(params.columnApi)

    const ensureRowIds = (rows) => {
      return rows.map(row => {
        if (!row.id) {
          return { 
            ...row, 
            id: uuid()
          }
        }
        return row
      })
    }

    if(notionalTransfers && notionalTransfers.length > 0) {
      try {
        setRowData(ensureRowIds(notionalTransfers))
      } catch (error) {
        setAlertMessage(t('fuelCode:fuelCodeLoadFailMsg'))
        setAlertSeverity('error')
      }
    } else {
      const id = uuid()
      const emptyRow = { id, complianceReportId }
      setRowData([emptyRow])
    }

    params.api.sizeColumnsToFit()
  }

  const validationHandler = useCallback(
    async (row) => {
      try {
        await notionalTransferSchema(t, optionsData).validate(row.data)
        const updatedRow = { ...row.data, isValid: true, validationMsg: '' }
        gridApi.applyTransaction({ update: [updatedRow] })
        setAlertMessage(`Validated notional transfer`)
        setAlertSeverity('success')
        alertRef.current?.triggerAlert()
      } catch (err) {
        const updatedRow = { ...row.data, isValid: false, validationMsg: err.errors[0] }
        gridApi.applyTransaction({ update: [updatedRow] })
        setAlertMessage(err.errors[0])
        setAlertSeverity('error')
        alertRef.current?.triggerAlert()
      }
    },
    [gridApi, optionsData, t]
  )

  const onRowEditingStarted = useCallback(
    (params) => {
      if (params.data.modified) validationHandler(params)
    },
    [validationHandler]
  )

  const onValidated = (status, message) => {
    setAlertMessage(message)
    setAlertSeverity(status)
    alertRef.current?.triggerAlert()
  }

  const statusBarComponent = useMemo(
    () => (
      <Box component="div" m={2}>
        <AddRowsButton gridApi={gridApi} complianceReportId={complianceReportId} />
      </Box>
    ),
    [gridApi, complianceReportId]
  )

  if (optionsLoading || transfersLoading) {
    return <Loading />
  }

  return (
    isFetched && (
      <Grid2 className="add-edit-notional-transfer-container" mx={-1}>
        <div>
          {alertMessage && (
            <BCAlert ref={alertRef} data-test="alert-box" severity={alertSeverity} delay={5000}>
              {alertMessage}
            </BCAlert>
          )}
        </div>
        <div className="header">
          <Typography variant="h5" color="primary">
            {t('notionalTransfer:newNotionalTransferTitle')}
          </Typography>
        </div>
        <BCBox my={2} component="div" style={{ height: '100%', width: '100%' }}>
          <BCDataGridEditor
            gridKey={gridKey}
            className="ag-theme-quartz"
            getRowId={(params) => params.data.id}
            gridRef={gridRef}
            columnDefs={notionalTransferColDefs(t, optionsData, gridApi)}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            rowData={rowData}
            setRowData={setRowData}
            gridApi={gridApi}
            columnApi={columnApi}
            gridOptions={gridOptions}
            getRowNodeId={(data) => data.id}
            defaultStatusBar={false}
            statusBarComponent={statusBarComponent}
            onRowEditingStarted={onRowEditingStarted}
            saveRow={saveRow}
            onValidated={onValidated}
          />
        </BCBox>
        <Stack
          direction={{ md: 'column', lg: 'row' }}
          spacing={{ xs: 2, sm: 2, md: 3 }}
          useFlexGap
          flexWrap="wrap"
          m={2}
        >
          <BCButton
            variant="contained"
            size="medium"
            color="primary"
            startIcon={<FontAwesomeIcon icon={faFloppyDisk} className="small-icon" />}
            onClick={() => gridApi.stopEditing(false)}
          >
            <Typography variant="subtitle2">{t('notionalTransfer:saveNotionalTransferBtn')}</Typography>
          </BCButton>
        </Stack>
      </Grid2>
    )
  )
}
