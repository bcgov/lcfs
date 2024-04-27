// mui components
import BCAlert from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import BCBox from '@/components/BCBox'
import { Stack, Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
// ag-grid
import BCDataGridEditor from '@/components/BCDataGrid/BCDataGridEditor'
import { fuelCodeColDefs, defaultColDef } from './_schema'
import { AddRowsDropdownButton } from './AddRowsDropdownButton'
// react components
import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
// services
import { useApiService } from '@/services/useApiService'
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
  const apiService = useApiService()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation(['common', 'fuelCode'])
  const { fuelCodeId } = useParams()

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
  const saveData = useCallback(() => {
    const allRowData = []
    gridApi.forEachNode((node) => allRowData.push(node.data))
    const modifiedRows = allRowData.filter((row) => row.modified)
    console.log(modifiedRows)
    // Add your API call to save modified rows here
  }, [])

  const statusBarcomponent = useMemo(() => {
    return (
      <Stack direction="row" m={2}>
        <AddRowsDropdownButton gridApi={gridApi} />
      </Stack>
    )
  })

  return (
    <Grid2 className="add-edit-fuel-code-container" mx={-1}>
      <div>
        {alertMessage && (
          <BCAlert data-test="alert-box" severity={alertSeverity}>
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
          columnDefs={fuelCodeColDefs(t)}
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
        />
      </BCBox>
    </Grid2>
  )
}
