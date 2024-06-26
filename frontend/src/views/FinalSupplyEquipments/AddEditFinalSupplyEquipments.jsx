import { useState, useEffect, useMemo, useRef } from 'react'
import { Box, Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import Loading from '@/components/Loading'
import BCDataGridEditor from '@/components/BCDataGrid/BCDataGridEditor'
import { defaultColDef, finalSupplyEquipmentColDefs } from './_schema'
import { AddRowsButton } from '@/views/NotionalTransfers/components/AddRowsButton'
import {
  useFinalSupplyEquipmentOptions,
  useGetFinalSupplyEquipments,
  useSaveFinalSupplyEquipment
} from '@/hooks/useFinalSupplyEquipment'
import { v4 as uuid } from 'uuid'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export const AddEditFinalSupplyEquipments = () => {
  const [rowData, setRowData] = useState([])
  const [gridApi, setGridApi] = useState(null)
  const [columnApi, setColumnApi] = useState(null)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

  const gridRef = useRef(null)
  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'finalSupplyEquipment'])
  const params = useParams()
  const { complianceReportId, compliancePeriod } = params
  const { data: currentUser } = useCurrentUser()
  const {
    data: optionsData,
    isLoading: optionsLoading,
    isFetched
  } = useFinalSupplyEquipmentOptions()
  const { data: finalSupplyEquipments, isLoading: equipmentsLoading } =
    useGetFinalSupplyEquipments(
      complianceReportId,
      currentUser?.organization?.organizationId
    )
  const { mutate: saveRow } = useSaveFinalSupplyEquipment(params)

  const gridKey = 'add-final-supply-equipment'
  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t(
        'finalSupplyEquipment:noFinalSupplyEquipmentsFound'
      ),
      autoSizeStrategy: {
        type: 'fitCellContents',
        defaultMinWidth: 50,
        defaultMaxWidth: 600
      },
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

    if (finalSupplyEquipments && finalSupplyEquipments.length > 0) {
      const rows = finalSupplyEquipments.map((row) => ({
        ...row,
        levelOfEquipment: row.levelOfEquipment.name,
        fuelMeasurementType: row.fuelMeasurementType.type,
        intendedUses: row.intendedUseTypes.map(i => i.type)
      }))
      try {
        setRowData(ensureRowIds(rows))
      } catch (error) {
        setAlertMessage(t('finalSupplyEquipment:LoadFailMsg'))
        setAlertSeverity('error')
      }
    } else {
      const id = uuid()
      const emptyRow = { id, complianceReportId }
      setRowData([emptyRow])
    }

    params.api.sizeColumnsToFit()
  }

  const onValidated = (status, message, params, response) => {
    let errMsg = message
    if (status === 'error') {
      const field = t(`finalSupplyEquipment:finalSupplyEquipmentColLabels.${message.response?.data?.detail[0]?.loc[1]}`)
      errMsg = `Error updating row: ${field}  ${message.response?.data?.detail[0]?.msg}`
    } else if (status === 'success') {
      params.data.finalSupplyEquipmentId = response.data.finalSupplyEquipmentId
    }
    setAlertMessage(errMsg)
    setAlertSeverity(status)
    alertRef.current?.triggerAlert()
  }

  const statusBarComponent = useMemo(
    () => (
      <Box component="div" m={2}>
        <AddRowsButton
          gridApi={gridApi}
          complianceReportId={complianceReportId}
        />
      </Box>
    ),
    [gridApi, complianceReportId]
  )

  if (optionsLoading || equipmentsLoading) {
    return <Loading />
  }

  return (
    isFetched && (
      <Grid2 className="add-edit-final-supply-equipment-container" mx={-1}>
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
            {t('finalSupplyEquipment:fseTitle')}
          </Typography>
          <Typography
            variant="body4"
            color="primary"
            sx={{ marginY: '2rem' }}
            component="div"
          >
            {t('finalSupplyEquipment:fseSubtitle')}
          </Typography>
        </div>
        <BCBox my={2} component="div" style={{ height: '100%', width: '100%' }}>
          <BCDataGridEditor
            gridKey={gridKey}
            className="ag-theme-quartz"
            getRowId={(params) => params.data.id}
            gridRef={gridRef}
            columnDefs={finalSupplyEquipmentColDefs(
              t,
              optionsData,
              compliancePeriod,
              gridApi,
              onValidated
            )}
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
            saveRow={saveRow}
            onValidated={onValidated}
          />
        </BCBox>
      </Grid2>
    )
  )
}
