// react and other external library components
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { v4 as uuid } from 'uuid'
// utils
import withRole from '@/utils/withRole'
// constants
import { roles } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
// mui components
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { Box, Typography } from '@mui/material'
// internal components
import BCDataGridEditorV2 from '@/components/BCDataGrid/BCDataGridEditorV2'
import { AddRowsDropdownButton } from './components/AddRowsDropdownButton'
// hooks
import { useTranslation } from 'react-i18next'
import { useApiService } from '@/services/useApiService'
import {
  useAddFuelCodes,
  useFuelCodeOptions,
  useSaveFuelCode
} from '@/hooks/useFuelCode'
import { fuelCodeColDefs, defaultColDef } from './_schemaV2'

const AddFuelCodeBaseV2 = () => {
  // state variables
  const [rowData, setRowData] = useState([])
  const [gridApi, setGridApi] = useState(null)
  const [columnApi, setColumnApi] = useState(null)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

  // hooks and refs setup
  const { t } = useTranslation()
  const { fuelCodeId } = useParams()
  const gridRef = useRef(null)
  const alertRef = useRef()
  const apiService = useApiService()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: optionsData, isLoading, isFetched } = useFuelCodeOptions()

  // ag-grid components and values
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
  // Alert effect on error, success and Updates.
  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const onGridReady = useCallback((params) => {
    setGridApi(params.api)
    setColumnApi(params.columnApi)
    setRowData(fuelCodeId ? [] : [{ id: uuid()}])
  }, [fuelCodeId])

  const statusBarComponent = useMemo(
    () => (
      <Box component="div" m={2}>
        <AddRowsDropdownButton gridApi={gridApi} />
      </Box>
    ),
    [gridApi]
  )

  const onValidated = useCallback((params) => {
    if (params.data.id === undefined) {
      params.data.id = uuid()
    }
    params.api.applyTransaction({ add: [params.data] })
  }, [])

  return (
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
        <BCDataGridEditorV2
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
          // onRowEditingStarted={onRowEditingStarted}
          // onRowEditingStopped={onRowEditingStopped}
          // saveRow={saveRow}
          // onValidated={onValidated}
        />
      </BCBox>
    </Grid2>
  )
}

export const AddFuelCodeV2 = withRole(
  AddFuelCodeBaseV2,
  [roles.analyst],
  ROUTES.DASHBOARD
)
