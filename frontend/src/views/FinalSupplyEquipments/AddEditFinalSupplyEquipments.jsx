import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { BCAlert2 } from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import { defaultColDef, finalSupplyEquipmentColDefs } from './_schema'
import {
  useFinalSupplyEquipmentOptions,
  useGetFinalSupplyEquipments,
  useSaveFinalSupplyEquipment
} from '@/hooks/useFinalSupplyEquipment'
import { v4 as uuid } from 'uuid'
import * as ROUTES from '@/constants/routes/routes.js'
import { isArrayEmpty } from '@/utils/formatters'

export const AddEditFinalSupplyEquipments = () => {
  const [rowData, setRowData] = useState([])
  const gridRef = useRef(null)
  const [gridApi, setGridApi] = useState(null)
  const [errors, setErrors] = useState({})
  const [columnDefs, setColumnDefs] = useState([])
  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'finalSupplyEquipment', 'reports'])
  const params = useParams()
  const { complianceReportId, compliancePeriod } = params
  const navigate = useNavigate()

  const {
    data: optionsData,
    isLoading: optionsLoading,
    isFetched
  } = useFinalSupplyEquipmentOptions()
  const { mutateAsync: saveRow } =
    useSaveFinalSupplyEquipment(complianceReportId)
  const { data, isLoading: equipmentsLoading } =
    useGetFinalSupplyEquipments(complianceReportId)

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t(
        'finalSupplyEquipment:noFinalSupplyEquipmentsFound'
      ),
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

  const onGridReady = useCallback(
    async (params) => {
      setGridApi(params.api)
      if (isArrayEmpty(data)) {
        setRowData([
          {
            id: uuid(),
            complianceReportId,
            supplyFromDate: `${compliancePeriod}-01-01`,
            supplyToDate: `${compliancePeriod}-12-31`
          }
        ])
      } else {
        setRowData(
          data.finalSupplyEquipments.map((item) => ({
            ...item,
            levelOfEquipment: item.levelOfEquipment.name,
            fuelMeasurementType: item.fuelMeasurementType.type,
            intendedUses: item.intendedUseTypes.map((i) => i.type),
            intendedUsers: item.intendedUserTypes.map((i) => i.typeName),
            id: uuid()
          }))
        )
      }
      params.api.sizeColumnsToFit()
    },
    [compliancePeriod, complianceReportId, data]
  )

  useEffect(() => {
    if (optionsData?.levelsOfEquipment?.length > 0) {
      const updatedColumnDefs = finalSupplyEquipmentColDefs(
        optionsData,
        compliancePeriod,
        errors
      )
      setColumnDefs(updatedColumnDefs)
    }
  }, [compliancePeriod, errors, optionsData])

  const onCellEditingStopped = useCallback(
    async (params) => {
      if (params.oldValue === params.newValue) return

      params.node.updateData({
        ...params.node.data,
        validationStatus: 'pending'
      })

      alertRef.current?.triggerAlert({
        message: 'Updating row...',
        severity: 'pending'
      })

      // clean up any null or empty string values
      let updatedData = Object.entries(params.node.data)
        .filter(([, value]) => value !== null && value !== '')
        .reduce((acc, [key, value]) => {
          acc[key] = value
          return acc
        }, {})

      try {
        setErrors({})
        const response = await saveRow(updatedData)
        updatedData = {
          ...updatedData,
          finalSupplyEquipmentId: response.data.finalSupplyEquipmentId,
          validationStatus: 'success',
          modified: false
        }
        alertRef.current?.triggerAlert({
          message: 'Row updated successfully.',
          severity: 'success'
        })
      } catch (error) {
        const newErrors = error.response.data.errors
        let errMsg = ''
        if (newErrors) {
          setErrors({
            [params.node.data.id]: newErrors[0].fields[0]
          })
          const { fields, message } = newErrors[0]
          const fieldLabels = fields.map((field) =>
            t(`finalSupplyEquipment:finalSupplyEquipmentColLabels.${field}`)
          )
          if (fields[0] === 'postalCode') {
            errMsg = t('finalSupplyEquipment:postalCodeError')
          } else {
            errMsg = `Error updating row: ${
              fieldLabels.length === 1 ? fieldLabels[0] : ''
            } ${String(message).toLowerCase()}`
          }
        } else {
          errMsg = error.response.data?.detail
        }

        updatedData = {
          ...updatedData,
          validationStatus: 'error'
        }

        if (error.code === 'ERR_BAD_REQUEST') {
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
      const updatedRow = { ...params.node.data, deleted: true }

      params.api.applyTransaction({ remove: [params.node.data] })
      if (updatedRow.finalSupplyEquipmentId) {
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
        ...params.node.data,
        id: newRowID,
        serialNbr: null,
        latitude: null,
        longitude: null,
        finalSupplyEquipmentId: null,
        finalSupplyEquipment: null,
        validationStatus: 'error',
        modified: true
      }

      params.api.applyTransaction({
        add: [rowData],
        addIndex: params.node?.rowIndex + 1
      })

      setErrors({ [newRowID]: 'finalSupplyEquipment' })

      alertRef.current?.triggerAlert({
        message: 'Error updating row: Fuel supply equipment Fields required',
        severity: 'error'
      })
    }
  }

  const handleNavigateBack = useCallback(() => {
    navigate(
      ROUTES.REPORTS_VIEW.replace(
        ':compliancePeriod',
        compliancePeriod
      ).replace(':complianceReportId', complianceReportId)
    )
  }, [navigate, compliancePeriod, complianceReportId])

  const onAddRows = useCallback((numRows) => {
    return Array(numRows).fill().map(()=>({
      id: uuid(),
      complianceReportId,
      supplyFromDate: `${compliancePeriod}-01-01`,
      supplyToDate: `${compliancePeriod}-12-31`,
      validationStatus: 'error',
      modified: true
    }))
  }, [compliancePeriod, complianceReportId])

  return (
    isFetched &&
    !equipmentsLoading && (
      <Grid2 className="add-edit-final-supply-equipment-container" mx={-1}>
        <div className="header">
          <Typography variant="h5" color="primary">
            {t('finalSupplyEquipment:addFSErowsTitle')}
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
          <BCGridEditor
            gridRef={gridRef}
            alertRef={alertRef}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            rowData={rowData}
            onAddRows={onAddRows}
            gridOptions={gridOptions}
            loading={optionsLoading || equipmentsLoading}
            onCellEditingStopped={onCellEditingStopped}
            stopEditingWhenCellsLoseFocus
            onAction={onAction}
            showAddRowsButton={true}
            saveButtonProps={{
              enabled: true,
              text: t('report:saveReturn'),
              onSave: handleNavigateBack,
              confirmText: t('report:incompleteReport'),
              confirmLabel: t('report:returnToReport')
            }}
          />
        </BCBox>
      </Grid2>
    )
  )
}
