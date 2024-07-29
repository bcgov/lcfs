import { useState, useEffect, useMemo, useRef } from 'react'
import { Box, Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import Loading from '@/components/Loading'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import { defaultColDef, fuelSupplyColDefs } from './_schema'
import { AddRowsButton } from '@/views/NotionalTransfers/components/AddRowsButton'
import {
  useFuelSupplyOptions,
  useGetFuelSupplies,
  useSaveFuelSupply
} from '@/hooks/useFuelSupply'
import { v4 as uuid } from 'uuid'

export const AddEditFuelSupplies = () => {
  const [rowData, setRowData] = useState([])
  const [gridApi, setGridApi] = useState(null)
  const [columnApi, setColumnApi] = useState(null)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [errors, setErrors] = useState({})
  const [columnDefs, setColumnDefs] = useState([])

  const gridRef = useRef(null)
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
  const { data, isLoading: equipmentsLoading } =
    useGetFuelSupplies(complianceReportId)
  const { mutate: saveRow } = useSaveFuelSupply(params)

  const gridKey = 'add-fuel-supply'
  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('fuelSupply:noFuelSuppliesFound'),
      autoSizeStrategy: {
        type: 'fitCellContents',
        defaultMinWidth: 50,
        defaultMaxWidth: 600
      },
      getRowStyle: (params) => {
        const editableCellStyle = { backgroundColor: '#e6f7ff' }
        const styles = {}

        params.columns.forEach((column) => {
          if (column.getColDef().editable) {
            styles[column.getColId()] = editableCellStyle
          }
        })

        return { ...styles }
      }
      // editType: '',
      // stopEditingWhenCellsLoseFocus: true,
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
      return rows.map((row) => {
        if (!row.id) {
          return {
            ...row,
            id: uuid(),
            isValid: true
          }
        }
        return row
      })
    }

    if (data.fuelSupplies && data.fuelSupplies.length > 0) {
      const rows = data.fuelSupplies.map((row) => ({
        ...row,
        levelOfEquipment: row.levelOfEquipment.name,
        fuelMeasurementType: row.fuelMeasurementType.type,
        intendedUses: row.intendedUseTypes.map((i) => i.type)
      }))
      try {
        setRowData(ensureRowIds(rows))
      } catch (error) {
        setAlertMessage(t('fuelSupply:LoadFailMsg'))
        setAlertSeverity('error')
      }
    } else {
      const id = uuid()
      const emptyRow = { id, complianceReportId }
      setRowData([emptyRow])
    }

    params.api.sizeColumnsToFit()
  }

  useEffect(() => {
    if (optionsData?.fuelTypes?.length > 0) {
      const updatedColumnDefs = fuelSupplyColDefs(optionsData, errors)
      setColumnDefs(updatedColumnDefs)
    }
  }, [errors, optionsData])

  if (optionsLoading || equipmentsLoading) {
    return <Loading />
  }

  return (
    isFetched && (
      <Grid2 className="add-edit-fuel-supply-container" mx={-1}>
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
          />
        </BCBox>
      </Grid2>
    )
  )
}
