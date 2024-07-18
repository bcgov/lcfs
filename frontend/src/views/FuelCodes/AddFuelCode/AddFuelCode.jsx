import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCDataGridEditor from '@/components/BCDataGrid/BCDataGridEditor'
import Loading from '@/components/Loading'
import { roles } from '@/constants/roles'
import { ROUTES, apiRoutes } from '@/constants/routes'
import { FUEL_CODE_STATUSES } from '@/constants/statuses'
import {
  useAddFuelCodes,
  useFuelCodeOptions,
  useFuelCodeSearch,
  useSaveFuelCode
} from '@/hooks/useFuelCode'
import { useApiService } from '@/services/useApiService'
import withRole from '@/utils/withRole'
import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Box, Stack, Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { defaultColDef, fuelCodeColDefs, fuelCodeSchema } from './_schema'
import { AddRowsDropdownButton } from './components/AddRowsDropdownButton'
import { isEqual } from '@/utils/eventHandlers'

const AddFuelCodeBase = () => {
  const [rowData, setRowData] = useState([])
  const [gridApi, setGridApi] = useState(null)
  const [columnApi, setColumnApi] = useState(null)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [focusedCell, setFocusedCell] = useState()
  const gridRef = useRef(null)
  const alertRef = useRef()
  const apiService = useApiService()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation(['common', 'fuelCode'])
  const { fuelCodeId } = useParams()
  const { data: optionsData, isLoading, isFetched } = useFuelCodeOptions()
  const { mutate: saveRow } = useSaveFuelCode()

  const gridKey = 'add-fuel-code'
  const gridOptions = useMemo(() => ({
    editType: undefined,
    overlayNoRowsTemplate: t('fuelCode:noFuelCodesFound'),
    autoSizeStrategy: {
      type: 'fitCellContents',
      defaultMinWidth: 50,
      defaultMaxWidth: 600
    }
  }),[t])
  // const getRowId = useCallback((params) => params.data.fuelCodeId, [])

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
  }, [apiService, fuelCodeId])

  const onGridReady = (params) => {
    setGridApi(params.api)
    setColumnApi(params.columnApi)

    if (!fuelCodeId) {
      const id = uuid()
      const emptyRow = { id, prefix: 'BCLCF' }
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

  const validationHandler = useCallback(
    async (row) => {
      try {
        await fuelCodeSchema(t, optionsData).validate(row.data)
        const updatedRow = { ...row.data, isValid: true, validationMsg: '' }
        gridApi.applyTransaction({ update: [updatedRow] })
        setAlertMessage(`Validated fuel code`)
        setAlertSeverity('success')
        alertRef.current?.triggerAlert()
      } catch (err) {
        const updatedRow = {
          ...row.data,
          isValid: false,
          validationMsg: err.errors[0]
        }
        gridApi.applyTransaction({ update: [updatedRow] })
        setAlertMessage(err.errors[0])
        setAlertSeverity('error')
        alertRef.current?.triggerAlert()
        // throw new Error()
      }
    },
    [gridApi, optionsData, t]
  )

  const onValidated = (status, message, params, response) => {
    let errMsg = message
    const columnHandlerList = ['fuelCode', 'fuelProductionFacilityCity', 'fuelProductionFacilityProvinceState']
    if (status === 'error') {
      if (focusedCell && columnHandlerList.some((item) => focusedCell.column.colId.includes(item))) {
        switch (focusedCell.column.colId) {
          case 'fuelCode':
            gridApi.startEditingCell({
              rowIndex: focusedCell.rowIndex,
              colKey: 'carbonIntensity'
            })
            setFocusedCell(undefined)
            break
          case 'fuelProductionFacilityCity':
          case 'fuelProductionFacilityProvinceState':
            gridApi.startEditingCell({
              rowIndex: focusedCell.rowIndex,
              colKey: 'facilityNameplateCapacity'
            })
            setFocusedCell(undefined)
            break
        }
      }
      const field = message.response?.data?.detail[0]?.loc[1]
        ? t(`fuelCode:fuelCodeColLabels.${message.response?.data?.detail[0]?.loc[1]}`)
        : ''

      errMsg = `Error updating row: ${field} ${message.response?.data?.detail[0]?.msg}`
      params.data.isValid = false
      params.data.validationMsg = `${field} ${message.response?.data?.detail[0]?.msg}`
    }
    setAlertMessage(errMsg)
    setAlertSeverity(status)
    alertRef.current?.triggerAlert()
  }

  // const onRowEditingStarted = useCallback(
  //   (params) => {
  //     if (params.data.modified && params.data.isValid) validationHandler(params)
  //   },
  //   [validationHandler]
  // )

  const onRowEditingStopped = useCallback(
    (params) => {
      params.node.setData({ ...params.data, modified: true })
      const focusedCell = params.api.getFocusedCell()
      setFocusedCell(focusedCell)
      if (focusedCell.column.colId === 'fuelCode') {
        const fuelCodeData = optionsData.latestFuelCodes.find(
          (fuelCode) => fuelCode.fuelCode === params.data.fuelCode
        )
        const updatedData = {
          ...params.data,
          prefix: fuelCodeData.fuelCodePrefix.prefix,
          company: fuelCodeData.company,
          fuel: fuelCodeData.fuelCodeType.fuelType,
          feedstock: fuelCodeData.feedstock,
          feedstockLocation: fuelCodeData.feedstockLocation,
          feedstockMisc: fuelCodeData.feedstockMisc,
          fuelProductionFacilityLocation:
            fuelCodeData.fuelProductionFacilityLocation,
          feedstockTransportMode: fuelCodeData.feedstockFuelTransportModes.map(
            (mode) => mode.feedstockFuelTransportMode.transportMode
          ),
          finishedFuelTransportMode:
            fuelCodeData.finishedFuelTransportModes.map(
              (mode) => mode.finishedFuelTransportMode.transportMode
            ),
          formerCompany: fuelCodeData.formerCompany,
          contactName: fuelCodeData.contactName,
          contactEmail: fuelCodeData.contactEmail
        }
        gridApi.applyTransaction({ update: [updatedData] })
        gridApi.startEditingCell({
          rowIndex: focusedCell.rowIndex,
          colKey: 'company'
        })
      } else if (focusedCell.column.colId === 'fuelProductionFacilityCity') {
        const location = optionsData.fpLocations.find(
          (location) =>
            location.fuelProductionFacilityCity ===
            params.data.fuelProductionFacilityCity
        )
        const updatedData = {
          ...params.data,
          fuelProductionFacilityProvinceState:
            location.fuelProductionFacilityProvinceState,
          fuelProductionFacilityCountry: location.fuelProductionFacilityCountry
        }
        gridApi.applyTransaction({ update: [updatedData] })
        gridApi.startEditingCell({
          rowIndex: focusedCell.rowIndex,
          colKey: 'facilityNameplateCapacity'
        })
      } else if (
        focusedCell.column.colId === 'fuelProductionFacilityProvinceState'
      ) {
        const location = optionsData.fpLocations.find(
          (location) =>
            location.fuelProductionFacilityProvinceState ===
            params.data.fuelProductionFacilityProvinceState
        )
        const updatedData = {
          ...params.data,
          fuelProductionFacilityCountry: location.fuelProductionFacilityCountry
        }
        gridApi.applyTransaction({ update: [updatedData] })
        gridApi.startEditingCell({
          rowIndex: focusedCell.rowIndex,
          colKey: 'facilityNameplateCapacity'
        })
      } else {
        validationHandler(params)
      }
    },
    [validationHandler, gridApi, optionsData]
  )

  const onCellValueChanged = useCallback((params) => {
    if (!isEqual(params.oldValue, params.newValue)) {
      params.data.modified = true
    }
    if (params.column.colId === 'fuelCode') {
      console.log(params.node.data)
    }
  },[])

  const statusBarComponent = useMemo(
    () => (
      <Box component="div" m={2}>
        <AddRowsDropdownButton gridApi={gridApi} />
      </Box>
    ),
    [gridApi]
  )

  const { mutate: addFuelCodes, isLoading: isAddFuelCodeLoading } =
    useAddFuelCodes({
      onSuccess: () => {
        localStorage.removeItem(gridKey)
        navigate(ROUTES.FUELCODES, {
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

  const getTransportModeIds = useCallback(
    (transportMode) => {
      const transportModeIds = []
      if (transportMode) {
        transportMode.forEach((mode) => {
          const foundMode = optionsData.transportModes.find(
            (elm) => elm.transportMode === mode
          )
          if (foundMode) {
            transportModeIds.push({
              fuelCodeId: null,
              transportModeId: foundMode.transportModeId
            })
          }
        })
      }
      return transportModeIds
    },
    [optionsData]
  )

  const handleSaveDraftCodes = async () => {
    gridApi.stopEditing(false)
    const allRowData = []
    gridApi.forEachNode(async (row) => {
      await validationHandler(row)
      const data = {
        ...row.data,
        lastUpdated: new Date(),
        prefixId: optionsData.fuelCodePrefixes.find(
          (elm) => elm.prefix === row.data.prefix
        ).fuelCodePrefixId,
        fuelTypeId: optionsData.fuelTypes.find(
          (elm) => elm.fuelType === row.data.fuel
        ).fuelTypeId,
        feedstockFuelTransportModes: getTransportModeIds(
          row.data.feedstockTransportMode
        ),
        finishedFuelTransportModes: getTransportModeIds(
          row.data.finishedFuelTransportMode
        ),
        fuelCodeId: null,
        status: FUEL_CODE_STATUSES.DRAFT,
        fuelCode: String(row.data.fuelCode)
      }
      allRowData.push(data)
    })

    addFuelCodes({ data: allRowData })
  }

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
            columnDefs={fuelCodeColDefs(t, optionsData, gridApi, onValidated)}
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
            onCellValueChanged={onCellValueChanged}
            // onRowEditingStarted={onRowEditingStarted}
            onRowEditingStopped={onRowEditingStopped}
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
            startIcon={
              <FontAwesomeIcon icon={faFloppyDisk} className="small-icon" />
            }
            // onClick={handleSaveDraftCodes}
            onClick={() => {
              console.log('save click')
            }}
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

export const AddFuelCode = withRole(
  AddFuelCodeBase,
  [roles.analyst],
  ROUTES.DASHBOARD
)
