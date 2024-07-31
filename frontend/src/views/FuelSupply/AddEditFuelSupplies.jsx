import { useState, useEffect, useMemo, useRef } from 'react'
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
  const { mutateAsync: saveRow } = useSaveFuelSupply()

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

  return (
    isFetched && (
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
          />
        </BCBox>
      </Grid2>
    )
  )
}
