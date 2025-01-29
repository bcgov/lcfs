import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BCTypography from '@/components/BCTypography'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
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
import { handleScheduleDelete, handleScheduleSave } from '@/utils/schedules.js'

export const AddEditFinalSupplyEquipments = () => {
  const [rowData, setRowData] = useState([])
  const gridRef = useRef(null)
  const [errors, setErrors] = useState({})
  const [warnings, setWarnings] = useState({})
  const [columnDefs, setColumnDefs] = useState([])

  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'finalSupplyEquipment', 'reports'])
  const guides = t('finalSupplyEquipment:reportingResponsibilityInfo', {
    returnObjects: true
  })
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
        setRowData([
          ...data.finalSupplyEquipments.map((item) => ({
            ...item,
            levelOfEquipment: item.levelOfEquipment.name,
            intendedUses: item.intendedUseTypes.map((i) => i.type),
            intendedUsers: item.intendedUserTypes.map((i) => i.typeName),
            id: uuid()
          })),
          {
            id: uuid(),
            complianceReportId,
            supplyFromDate: `${compliancePeriod}-01-01`,
            supplyToDate: `${compliancePeriod}-12-31`
          }
        ])
      }
      params.api.sizeColumnsToFit()

      setTimeout(() => {
        const lastRowIndex = params.api.getLastDisplayedRowIndex()
        params.api.startEditingCell({
          rowIndex: lastRowIndex,
          colKey: 'organizationName'
        })
      }, 100)
    },
    [compliancePeriod, complianceReportId, data]
  )

  useEffect(() => {
    if (optionsData?.levelsOfEquipment?.length > 0) {
      const updatedColumnDefs = finalSupplyEquipmentColDefs(
        optionsData,
        compliancePeriod,
        errors,
        warnings
      )
      setColumnDefs(updatedColumnDefs)
    }
  }, [compliancePeriod, errors, warnings, optionsData])

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

      updatedData = await handleScheduleSave({
        alertRef,
        idField: 'finalSupplyEquipmentId',
        labelPrefix: 'finalSupplyEquipment:finalSupplyEquipmentColLabels',
        params,
        setErrors,
        setWarnings,
        saveRow,
        t,
        updatedData
      })

      params.node.updateData(updatedData)
    },
    [saveRow, t]
  )

  const onAction = async (action, params) => {
    if (action === 'delete') {
      await handleScheduleDelete(
        params,
        'finalSupplyEquipmentId',
        saveRow,
        alertRef,
        setRowData,
        {
          complianceReportId,
          supplyFromDate: `${compliancePeriod}-01-01`,
          supplyToDate: `${compliancePeriod}-12-31`
        }
      )
    }
    if (action === 'duplicate') {
      const newRowID = uuid()
      const rowData = {
        ...params.node.data,
        id: newRowID,
        kwhUsage: null,
        serialNbr: null,
        latitude: null,
        longitude: null,
        finalSupplyEquipmentId: null,
        finalSupplyEquipment: null,
        validationStatus: 'error',
        modified: true
      }

      const transaction = {
        add: [rowData],
        addIndex: params.node?.rowIndex + 1
      }

      setErrors({ [newRowID]: 'finalSupplyEquipment' })

      alertRef.current?.triggerAlert({
        message: 'Unable to save row: Fuel supply equipment fields required',
        severity: 'error'
      })
      return transaction
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

  const onAddRows = useCallback(
    (numRows) => {
      return Array(numRows)
        .fill()
        .map(() => ({
          id: uuid(),
          complianceReportId,
          supplyFromDate: `${compliancePeriod}-01-01`,
          supplyToDate: `${compliancePeriod}-12-31`,
          validationStatus: 'error',
          modified: true
        }))
    },
    [compliancePeriod, complianceReportId]
  )

  return (
    isFetched &&
    !equipmentsLoading && (
      <Grid2 className="add-edit-final-supply-equipment-container" mx={-1}>
        <div className="header">
          <BCTypography variant="h5" color="primary">
            {t('finalSupplyEquipment:fseTitle')}
          </BCTypography>
          <BCBox my={2.5} component="div">
            {guides.map((v, i) => (
              <BCTypography
                key={i}
                variant="body4"
                color="text"
                mt={0.5}
                component="div"
                dangerouslySetInnerHTML={{ __html: v }}
              />
            ))}
          </BCBox>
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
