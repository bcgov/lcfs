import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
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
import { defaultColDef, fuelCodeColDefs, fuelCodeSchema } from './_schema'
import { AddRowsDropdownButton } from './AddRowsDropdownButton'
import { useApiService } from '@/services/useApiService'
import { useFuelCodeOptions, useAddFuelCodes, useSaveFuelCode } from '@/hooks/useFuelCode'
import { v4 as uuid } from 'uuid'
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
  const { mutate: saveRow } = useSaveFuelCode()

  const gridKey = 'add-fuel-code'
  const gridOptions = useMemo(() => ({
    overlayNoRowsTemplate: t('fuelCode:noFuelCodesFound'),
    autoSizeStrategy: {
      type: 'fitCellContents',
      defaultMinWidth: 50,
      defaultMaxWidth: 600
    }
  }))
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
  }, [apiService])

  const onGridReady = (params) => {
    setGridApi(params.api)
    setColumnApi(params.columnApi)

    if (!fuelCodeId) {
      const cachedRowData = JSON.parse(localStorage.getItem(gridKey))
      if (cachedRowData && cachedRowData.length > 0) {
        setRowData(cachedRowData)
      } else {
        const id = uuid()
        const emptyRow = { id }
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

  const onValidated = (status, message) => {
    setAlertMessage(message)
    setAlertSeverity(status)
    alertRef.current?.triggerAlert()
  }

  const onRowEditingStarted = useCallback(
    (params) => {
      if (params.data.modified && params.data.isValid) validationHandler(params)
    },
    [validationHandler]
  )

  const onRowEditingStopped = useCallback(
    (params) => {
      params.node.setData({ ...params.data, modified: true })
      const focusedCell = params.api.getFocusedCell()
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

  const saveData = useCallback(() => {
    const allRowData = []
    gridApi.forEachNode((node) => allRowData.push(node.data))
    const modifiedRows = allRowData.filter((row) => row.modified)
    // Add your API call to save modified rows here
  }, [gridApi])

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
        lastUpdated: new Date().toISOString().split('T')[0],
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
            columnDefs={fuelCodeColDefs(t, optionsData, gridApi)}
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
            onClick={() => {console.log('save click')}}
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
