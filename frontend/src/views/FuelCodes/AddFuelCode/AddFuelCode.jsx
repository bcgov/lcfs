import { BCAlert2 } from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import Loading from '@/components/Loading'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { useFuelCodeOptions, useSaveFuelCode } from '@/hooks/useFuelCode'
import withRole from '@/utils/withRole'
import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Stack, Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { defaultColDef, fuelCodeColDefs } from './_schema'
import { AddRowsDropdownButton } from './components/AddRowsDropdownButton'

const AddFuelCodeBase = () => {
  const [rowData, setRowData] = useState([])
  const gridRef = useRef(null)
  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'fuelCode'])
  const { data: optionsData, isLoading, isFetched } = useFuelCodeOptions()
  const { mutateAsync: saveRow } = useSaveFuelCode()
  const [errors, setErrors] = useState({})

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
      alertRef.current?.triggerAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
    }
  }, [location.state])

  const onGridReady = useCallback((params) => {
    setRowData([{ id: uuid() }])
    params.api.sizeColumnsToFit()
  }, [])

  const onCellEditingStopped = useCallback(
    async (params) => {
      params.node.updateData({ validationStatus: 'pending' })

      alertRef.current?.triggerAlert({
        message: 'Updating row...',
        severity: 'pending'
      })

      let updatedData = params.data

      if (params.data.fuelCode !== undefined && params.data.fuelCode) {
        const fuelCodeData = optionsData.latestFuelCodes.find(
          (fuelCode) =>
            fuelCode.fuelCode.split('.')[0] ===
            params.data.fuelCode.split('.')[0]
        )

        updatedData = {
          ...updatedData,
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
      }
      if (params.data.fuelProductionFacilityCity !== undefined) {
        const location = optionsData.fpLocations.find(
          (location) =>
            location.fuelProductionFacilityCity ===
            params.data.fuelProductionFacilityCity
        )
        updatedData = {
          ...updatedData,
          fuelProductionFacilityProvinceState:
            location.fuelProductionFacilityProvinceState,
          fuelProductionFacilityCountry: location.fuelProductionFacilityCountry
        }
      }
      if (params.data.fuelProductionFacilityProvinceState) {
        const location = optionsData.fpLocations.find(
          (location) =>
            location.fuelProductionFacilityProvinceState ===
            params.data.fuelProductionFacilityProvinceState
        )
        updatedData = {
          ...updatedData,
          fuelProductionFacilityCountry: location.fuelProductionFacilityCountry
        }
      }

      // clean up any null or empty string values
      updatedData = Object.entries(updatedData)
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
          validationStatus: 'success',
          modified: false
        }
        alertRef.current?.triggerAlert({
          message: 'Row updated successfully.',
          severity: 'success'
        })
      } catch (error) {
        const errArr = {
          [params.data.id]: error.response.data.detail.map((err) => err.loc[1])
        }
        setErrors(errArr)

        updatedData = {
          ...updatedData,
          validationStatus: 'error'
        }

        if (error.code === 'ERR_BAD_REQUEST') {
          const field = error.response?.data?.detail[0]?.loc[1]
            ? t(
                `fuelCode:fuelCodeColLabels.${error.response?.data?.detail[0]?.loc[1]}`
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
    [optionsData, saveRow, t]
  )

  const onAction = async (action, params) => {
    if (action === 'delete') {
      const updatedRow = { ...params.data, deleted: true }

      params.api.applyTransaction({ remove: [params.node.data] })
      if (updatedRow.fuelCodeId) {
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
        ...params.data,
        id: newRowID,
        fuelCodeId: null,
        fuelCode: null,
        validationStatus: 'error',
        modified: true
      }

      params.api.applyTransaction({
        add: [rowData],
        addIndex: params.node?.rowIndex + 1
      })

      setErrors({ [newRowID]: 'fuelCode' })

      alertRef.current?.triggerAlert({
        message: 'Error updating row: Fuel code Field required',
        severity: 'error'
      })
    }
  }

  if (isLoading) {
    return <Loading />
  }

  return (
    isFetched && (
      <Grid2 className="add-edit-fuel-code-container" mx={-1}>
        <BCAlert2 ref={alertRef} data-test="alert-box" />
        <div className="header">
          <Typography variant="h5" color="primary">
            {t('fuelCode:newFuelCodeTitle')}
          </Typography>
        </div>
        <BCGridEditor
          gridRef={gridRef}
          columnDefs={fuelCodeColDefs(optionsData, errors)}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          rowData={rowData}
          gridOptions={gridOptions}
          onCellEditingStopped={onCellEditingStopped}
          loading={isLoading}
          onAction={onAction}
        />
        <BCBox
          display="flex"
          justifyContent="flex-start"
          variant="outlined"
          sx={{
            maxHeight: '4.5rem',
            position: 'relative',
            border: 'none',
            borderRadius: '0px 0px 4px 4px',
            overflow: 'hidden'
          }}
        >
          <AddRowsDropdownButton gridApi={gridRef.current?.api} />
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
