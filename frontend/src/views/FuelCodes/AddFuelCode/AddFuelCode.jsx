import BCAlert from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import Loading from '@/components/Loading'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { useFuelCodeOptions, useSaveFuelCode } from '@/hooks/useFuelCode'
import withRole from '@/utils/withRole'
import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Box, Stack, Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { defaultColDef, fuelCodeColDefs, fuelCodeSchema } from './_schema'
import { AddRowsDropdownButton } from './components/AddRowsDropdownButton'

const AddFuelCodeBase = () => {
  const [rowData, setRowData] = useState([])
  const [gridApi, setGridApi] = useState(null)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

  const gridRef = useRef(null)
  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'fuelCode'])
  const { data: optionsData, isLoading, isFetched } = useFuelCodeOptions()
  const { mutate: saveRow } = useSaveFuelCode()

  const gridKey = 'add-fuel-code'
  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('fuelCode:noFuelCodesFound'),
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
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])
  const onGridReady = useCallback((params) => {
    setGridApi(params.api)
    const cachedRowData = JSON.parse(localStorage.getItem(gridKey))
    if (cachedRowData && cachedRowData.length > 0) {
      setRowData(cachedRowData)
    } else {
      const id = uuid()
      const emptyRow = { id }
      setRowData([emptyRow])
    }
    params.api.sizeColumnsToFit()
  }, [])

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
    if (status === 'error') {
      const field = message.response?.data?.detail[0]?.loc[1]
        ? t(
            `fuelCode:fuelCodeColLabels.${message.response?.data?.detail[0]?.loc[1]}`
          )
        : ''

      errMsg = `Error updating row: ${field} ${message.response?.data?.detail[0]?.msg}`
      params.data.isValid = false
      params.data.validationMsg = `${field} ${message.response?.data?.detail[0]?.msg}`
    }
    setAlertMessage(errMsg)
    setAlertSeverity(status)
    alertRef.current?.triggerAlert()
  }

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

  const statusBarComponent = useMemo(
    () => (
      <Box component="div" m={2}>
        <AddRowsDropdownButton gridApi={gridApi} />
      </Box>
    ),
    [gridApi]
  )

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
        <BCGridEditor
          gridRef={gridRef}
          columnDefs={fuelCodeColDefs(
            t,
            optionsData,
            gridRef.current?.api,
            onValidated
          )}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          rowData={rowData}
          gridOptions={gridOptions}
          statusBarComponent={statusBarComponent}
          onRowEditingStopped={onRowEditingStopped}
          saveRow={saveRow}
          onValidated={onValidated}
          loading={isLoading}
        />
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
