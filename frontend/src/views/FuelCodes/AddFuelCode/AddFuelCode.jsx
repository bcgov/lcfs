// mui components
import BCAlert from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import BCBox from '@/components/BCBox'
import { Box, Stack, Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import Loading from '@/components/Loading'
// Icons
import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// ag-grid
import BCDataGridEditor from '@/components/BCDataGrid/BCDataGridEditor'
import { fuelCodeColDefs, defaultColDef, fuelCodeSchema } from './_schema'
import { AddRowsDropdownButton } from './AddRowsDropdownButton'
// react components
import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
// services
import { useApiService } from '@/services/useApiService'
import { useFuelCodeOptions } from '@/hooks/useFuelCode'
import { v4 as uuid } from 'uuid'
// constants
import { ROUTES, apiRoutes } from '@/constants/routes'

export const AddFuelCode = () => {
  const [rowData, setRowData] = useState([])
  const [gridApi, setGridApi] = useState(null)
  const [columnApi, setColumnApi] = useState(null)
  const [gridKey, setGridKey] = useState('add-fuel-code')
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

  const gridRef = useRef(null)
  const alertRef = useRef()
  const apiService = useApiService()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation(['common', 'fuelCode'])
  const { fuelCodeId } = useParams()
  const { data: optionsData, isLoading, isFetched } = useFuelCodeOptions()

  const gridOptions = useMemo(() => ({
    overlayNoRowsTemplate: t('fuelCode:noFuelCodesFound'),
    autoSizeStrategy: {
      type: 'fitCellContents',
      defaultMinWidth: 50,
      defaultMaxWidth: 600
    }
  }))
  const getRowId = useCallback((params) => params.data.fuelCodeId, [])

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const fetchData = useCallback(async () => {
    await apiService
      .apply({
        method: 'get',
        url: apiRoutes.getFuelCode.replace(':fuelCodeId', fuelCodeId)
      })
      .then((resp) => {
        return resp.data
      })
  }, [apiService])

  function onGridReady(params) {
    setGridApi(params.api)
    setColumnApi(params.columnApi)

    if (!fuelCodeId) {
      const id = uuid()
      const emptyRow = { id, modified: true }
      setRowData([emptyRow])
    } else {
      try {
        const data = fetchData()
        setRowData(data.fuelCode)
      } catch (error) {
        setAlertMessage(t('fuelCode:fuelCodeLoadFailMsg'))
        setAlertSeverity('error')
      }
    }
    params.api.sizeColumnsToFit()
  }

  const validationHandler = useCallback((params) => {
    fuelCodeSchema(t, optionsData)
      .validate(params.data)
      .then((data) => {
        setAlertMessage(`Validated row # ${params.node.rowIndex + 1}`)
        setAlertSeverity('success')
        params.node.setData({
          ...params.data,
          isValid: true,
          validationgMsg: ''
        })
      })
      .catch((err) => {
        setAlertMessage(err.errors[0])
        setAlertSeverity('error')
        params.node.setData({
          ...params.data,
          isValid: false,
          validationgMsg: err.errors[0]
        })
      })
    alertRef.current.triggerAlert()
  })
  const onRowEditingStarted = useCallback((params) => {
    // perform initial validation
    validationHandler(params)
  })
  const onRowEditingStopped = useCallback((params) => {
    // peform final validation
    validationHandler(params)
  })
  const saveData = useCallback(() => {
    const allRowData = []
    gridApi.forEachNode((node) => allRowData.push(node.data))
    const modifiedRows = allRowData.filter((row) => row.modified)
    console.log(modifiedRows)
    // Add your API call to save modified rows here
  }, [])

  const statusBarcomponent = useMemo(() => {
    return (
      <Box component="div" m={2}>
        <AddRowsDropdownButton gridApi={gridApi} />
      </Box>
    )
  })

  if (isLoading) {
    return <Loading />
  }
  return (
    isFetched && (
      <Grid2 className="add-edit-fuel-code-container" mx={-1}>
        <div>
          {alertMessage && (
            <BCAlert
              ref={alertRef}
              data-test="alert-box"
              severity={alertSeverity}
              delay={5000}
            >
              {alertMessage}
            </BCAlert>
          )}
        </div>
        <div className="header">
          <Typography variant="h5" color="primary">
            {t('fuelCode:newFuelCodeTitle')}
          </Typography>
        </div>
        <BCBox my={2} component="div" style={{ height: '100%', width: '100%' }}>
          <BCDataGridEditor
            className="ag-theme-quartz"
            getRowId={(params) => params.data.id}
            gridRef={gridRef}
            columnDefs={fuelCodeColDefs(t, optionsData)}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            rowData={rowData}
            gridApi={gridApi}
            columnApi={columnApi}
            gridOptions={gridOptions}
            getRowNodeId={(data) => data.id}
            saveData={saveData}
            defaultStatusBar={false}
            statusBarcomponent={statusBarcomponent}
            onRowEditingStarted={onRowEditingStarted}
            onRowEditingStopped={onRowEditingStopped}
          />
        </BCBox>
        <Stack
          direction={{ md: 'coloumn', lg: 'row' }}
          spacing={{ xs: 2, sm: 2, md: 3 }}
          useFlexGap
          flexWrap="wrap"
          m={2}
        >
          <BCButton
            variant="contained"
            size="medium"
            color="primary"
            startIcon={
              <FontAwesomeIcon icon={faFloppyDisk} className="small-icon" />
            }
            onClick={() => navigate(ROUTES.ADMIN_FUEL_CODES)}
          >
            <Typography variant="subtitle2">
              {t('fuelCode:saveDraftBtn')}
            </Typography>
          </BCButton>
        </Stack>
      </Grid2>
    )
  )
}
