import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import { BCAlert2 } from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import { defaultColDef, fuelSupplyColDefs } from './_schema'
import {
  useFuelSupplyOptions,
  useGetFuelSupplies,
  useSaveFuelSupply
} from '@/hooks/useFuelSupply'
import { v4 as uuid } from 'uuid'

export const AddEditFuelSupplies = () => {
  const [rowData, setRowData] = useState([])
  const gridRef = useRef(null)
  const [gridApi, setGridApi] = useState()
  const [errors, setErrors] = useState({})
  const [columnDefs, setColumnDefs] = useState([])
  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'fuelSupply'])
  const params = useParams()
  const { complianceReportId, compliancePeriod } = params

  const {
    data: optionsData,
    isLoading: optionsLoading,
    isFetched
  } = useFuelSupplyOptions({ compliancePeriod })
  const { mutateAsync: saveRow } = useSaveFuelSupply({ complianceReportId })

  const { data, isLoading: fuelSuppliesLoading } =
    useGetFuelSupplies(complianceReportId)

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('fuelSupply:noFuelSuppliesFound'),
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

  const onGridReady = (params) => {
    setGridApi(params.api)
    setRowData([{ id: uuid() }])
    params.api.sizeColumnsToFit()
  }

  useEffect(() => {
    if (optionsData?.fuelTypes?.length > 0) {
      const updatedColumnDefs = fuelSupplyColDefs(optionsData, errors)
      setColumnDefs(updatedColumnDefs)
    }
  }, [errors, optionsData])

  const onCellValueChanged = useCallback((params) => {
    if (params.column.colId === 'quantity') {
      const quantity = parseInt(params.newValue)
      const fuelType = params.data.fuelType
      const fuelTypeData = optionsData.fuelTypes.find(
        (ft) => ft.fuelType === fuelType
      )

      if (fuelTypeData && quantity > fuelTypeData.maxQuantity) {
        alertRef.current?.triggerAlert({
          message: t('fuelSupply:quantityExceedsMax', {
            maxQuantity: fuelTypeData.maxQuantity
          }),
          severity: 'error'
        })
        params.node.updateData({
          ...params.data,
          quantity: fuelTypeData.maxQuantity
        })
      }
    }

    params.node.updateData({ ...params.data, modified: true })
  })

  const onCellEditingStopped = useCallback(
    async (params) => {
      if (params.oldValue === params.newValue) return

      params.node.updateData({ ...params.data, validationStatus: 'pending' })

      alertRef.current?.triggerAlert({
        message: 'Updating row...',
        severity: 'pending'
      })

      // clean up any null or empty string values
      let updatedData = Object.entries(params.data)
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
                `fuelSupply:fuelSupplyColLabels.${error.response?.data?.detail[0]?.loc[1]}`
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
    [saveRow, t]
  )

  const onAction = async (action, params) => {
    if (action === 'delete') {
      const updatedRow = { ...params.data, deleted: true }

      params.api.applyTransaction({ remove: [params.node.data] })
      if (updatedRow.fuelSupplyId) {
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
        fuelSupplyId: null,
        fuelSupply: null,
        validationStatus: 'error',
        modified: true
      }

      params.api.applyTransaction({
        add: [rowData],
        addIndex: params.node?.rowIndex + 1
      })

      setErrors({ [newRowID]: 'fuelSupply' })

      alertRef.current?.triggerAlert({
        message: 'Error updating row: Fuel supply Fields required',
        severity: 'error'
      })
    }
  }

  return (
    <Grid2 className="add-edit-fuel-supply-container" mx={-1}>
      <BCAlert2 ref={alertRef} data-test="alert-box" />
      <div className="header">
        <Typography variant="h5" color="primary">
          {t('fuelSupply:addFuelSupplyRowsTitle')}
        </Typography>
        <Typography
          variant="body4"
          color="primary"
          sx={{ marginY: '2rem' }}
          component="div"
        >
          {t('fuelSupply:fuelSupplySubtitle')}
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
          loading={optionsLoading || fuelSuppliesLoading}
          onCellValueChanged={onCellValueChanged}
          onCellEditingStopped={onCellEditingStopped}
          onAction={onAction}
          stopEditingWhenCellsLoseFocus
        />
      </BCBox>
    </Grid2>
  )
}
