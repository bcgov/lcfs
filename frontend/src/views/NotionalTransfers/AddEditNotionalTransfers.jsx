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
import { useNotionalTransferOptions, useAddNotionalTransfers, useGetNotionalTransfers } from '@/hooks/useNotionalTransfer'
import { v4 as uuid } from 'uuid'
import { ROUTES } from '@/constants/routes'

export const AddEditNotionalTransfers = () => {
  const [rowData, setRowData] = useState([])
  const [gridApi, setGridApi] = useState(null)
  const [columnApi, setColumnApi] = useState(null)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

  const gridRef = useRef(null)
  const alertRef = useRef()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation(['common', 'notionalTransfer'])
  const { complianceReportId } = useParams()
  const { data: optionsData, isLoading: optionsLoading, isFetched } = useNotionalTransferOptions()
  const { data: notionalTransfers, isLoading: transfersLoading } = useGetNotionalTransfers(complianceReportId)

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
  const getRowId = useCallback((params) => params.data.id, [])

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
          return { ...row, id: uuid() }
        }
        return row
      })
    }
  
    if (!complianceReportId) {
      const cachedRowData = JSON.parse(localStorage.getItem(gridKey))
      if (cachedRowData && cachedRowData.length > 0) {
        setRowData(ensureRowIds(cachedRowData))
      } else {
        const id = uuid()
        const emptyRow = { id }
        setRowData([emptyRow])
      }
    } else {
      try {
        setRowData(ensureRowIds(notionalTransfers))
      } catch (error) {
        setAlertMessage(t('fuelCode:fuelCodeLoadFailMsg'))
        setAlertSeverity('error')
      }
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
      if (params.data.modified && params.data.isValid) validationHandler(params)
    },
    [validationHandler]
  )

  const onRowEditingStopped = useCallback(
    (params) => {
      params.node.setData({ ...params.data, modified: true })
      validationHandler(params)
    },
    [validationHandler]
  )

  const saveData = useCallback(() => {
    const allRowData = []
    gridApi.forEachNode((node) => allRowData.push(node.data))
    const modifiedRows = allRowData.filter((row) => row.modified)
    // Add your API call to save modified rows here
    console.log('Saving data:', modifiedRows)
  }, [gridApi])

  const statusBarComponent = useMemo(
    () => (
      <Box component="div" m={2}>
        <AddRowsButton gridApi={gridApi} />
      </Box>
    ),
    [gridApi]
  )

  const { mutate: addNotionalTransfers, isLoading: isAddNotionalTransferLoading } = useAddNotionalTransfers(complianceReportId, {
    onSuccess: () => {
      localStorage.removeItem(gridKey)
      navigate(ROUTES.ADMIN_NOTIONAL_TRANSFERS, {
        state: {
          message: t('notionalTransfer:notionalTransferAddSuccessMsg'),
          severity: 'success',
        },
      })
    },
    onError: (error) => {
      setAlertMessage(t('notionalTransfer:notionalTransferAddFailMsg') + ' ' + error)
      setAlertSeverity('error')
      alertRef.current.triggerAlert()
    },
  })

  const handleSaveDraftTransfers = async () => {
    gridApi.stopEditing(false)
    const allRowData = []
    gridApi.forEachNode(async (row) => {
      await validationHandler(row)
      const data = {
        ...row.data,
        complianceReportId,
        lastUpdated: new Date().toISOString().split('T')[0],
      }
      allRowData.push(data)
    })

    addNotionalTransfers({ data: allRowData })
  }

  if (optionsLoading || isAddNotionalTransferLoading || transfersLoading) {
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
            saveData={saveData}
            defaultStatusBar={false}
            statusBarComponent={statusBarComponent}
            onRowEditingStarted={onRowEditingStarted}
            onRowEditingStopped={onRowEditingStopped}
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
            onClick={handleSaveDraftTransfers}
          >
            <Typography variant="subtitle2">{t('notionalTransfer:saveNotionalTransferBtn')}</Typography>
          </BCButton>
        </Stack>
      </Grid2>
    )
  )
}
