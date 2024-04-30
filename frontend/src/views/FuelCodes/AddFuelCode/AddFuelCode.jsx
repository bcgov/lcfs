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
import { useFuelCodeOptions, useAddFuelCodes } from '@/hooks/useFuelCode'
import { v4 as uuid } from 'uuid'
// constants
import { ROUTES, apiRoutes } from '@/constants/routes'
import { FUEL_CODE_STATUSES } from '@/constants/statuses'

export const AddFuelCode = () => {
  const [rowData, setRowData] = useState([])
  const [gridApi, setGridApi] = useState(null)
  const [columnApi, setColumnApi] = useState(null)
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

  const gridKey = 'add-fuel-code'
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
      const cachedRowData = JSON.parse(localStorage.getItem(gridKey))
      if (cachedRowData && cachedRowData.length > 0) {
        setRowData(cachedRowData)
      } else {
        const id = uuid()
        const emptyRow = { id, modified: true }
        setRowData([emptyRow])
      }
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
          validationMsg: ''
        })
      })
      .catch((err) => {
        setAlertMessage(err.errors[0])
        setAlertSeverity('error')
        params.node.setData({
          ...params.data,
          isValid: false,
          validationMsg: err.errors[0]
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

  const { mutate: addFuelCodes, isLoading: isAddFuelCodeLoading } =
    useAddFuelCodes({
      onSuccess: () => {
        localStorage.removeItem(gridKey)
        navigate(ROUTES.ADMIN_FUEL_CODES, {
          state: {
            message: t('fuelCode:fuelCodeAddSuccessMsg'),
            severity: 'success'
          }
        })
      },
      onError: (error) => {
        setAlertMessage(t('fuelCode:fuelCodeAddFailMsg') + ' ' + error)
        setAlertSeverity('error')
        alertRef.current.triggerAlert()
      }
    })

  const getTransportModeIds = useCallback((transportMode) => {
    const transportModeIds = []
    if (transportMode) {
      transportMode.forEach((transportMode) => {
        transportModeIds.push({
          fuelCodeId: null,
          transportModeId: optionsData.transportModes.find(
            (elm) => elm.transportMode === transportMode
          ).transportModeId
        })
      })
    }
    return transportModeIds
  })

  const handleSaveDraftCodes = useCallback(() => {
    const allRowData = []
    gridApi.forEachNode((node) => {
      // get status_id, prefix_id, fuel_type_id
      // transport_mode_id for feedstock and finished fuels
      const data = {
        ...node.data,
        lastUpdated: new Date().toLocaleDateString(),
        status: FUEL_CODE_STATUSES.DRAFT,
        prefix_id: optionsData.fuelCodePrefixes.find(
          (elm) => elm.prefix === node.data.prefix
        ).fuelCodePrefixId,
        fuelTypeId: optionsData.fuelTypes.find(
          (elm) => elm.fuelType === node.data.fuel
        ).fuelTypeId,
        feedstockFuelTransportModes: [
          ...getTransportModeIds(node.data.feedstockTransportMode)
        ],
        finishedFuelTransportModes: [
          ...getTransportModeIds(node.data.finishedFuelTransportMode)
        ]
      }
      allRowData.push(data)
    })
    addFuelCodes({ data: allRowData })
  })

  if (isLoading || isAddFuelCodeLoading) {
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
            gridKey={gridKey}
            className="ag-theme-quartz"
            getRowId={(params) => params.data.id}
            gridRef={gridRef}
            columnDefs={fuelCodeColDefs(t, optionsData)}
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
            onClick={handleSaveDraftCodes}
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
