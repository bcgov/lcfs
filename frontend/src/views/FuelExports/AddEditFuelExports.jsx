import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import { ROUTES } from '@/constants/routes'
import {
  useFuelExportOptions,
  useGetFuelExports,
  useSaveFuelExport
} from '@/hooks/useFuelExport'
import BCTypography from '@/components/BCTypography'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { defaultColDef, fuelExportColDefs } from './_schema'
import { handleScheduleDelete, handleScheduleSave } from '@/utils/schedules.js'
import { isArrayEmpty } from '@/utils/array.js'

export const AddEditFuelExports = () => {
  const [rowData, setRowData] = useState([])
  const gridRef = useRef(null)

  const [errors, setErrors] = useState({})
  const [warnings, setWarnings] = useState({})
  const [columnDefs, setColumnDefs] = useState([])
  const [gridReady, setGridReady] = useState(false)
  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'fuelExport'])
  const params = useParams()
  const { complianceReportId, compliancePeriod } = params
  const navigate = useNavigate()

  const {
    data: optionsData,
    isLoading: optionsLoading,
    isFetched
  } = useFuelExportOptions({ compliancePeriod })
  const { mutateAsync: saveRow } = useSaveFuelExport({ complianceReportId })

  const { data, isLoading: fuelExportsLoading } =
    useGetFuelExports(complianceReportId)

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('fuelExport:noFuelExportsFound'),
      stopEditingWhenCellsLoseFocus: false,
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
      if (!isArrayEmpty(data)) {
        const updatedRowData = data.fuelExports.map((item) => ({
          ...item,
          compliancePeriod,
          fuelCategory: item.fuelCategory?.category,
          fuelType: item.fuelType?.fuelType,
          provisionOfTheAct: item.provisionOfTheAct?.name,
          fuelCode: item.fuelCode?.fuelCode,
          endUse: item.endUse?.type || 'Any',
          id: uuid()
        }))
        setRowData([...updatedRowData, { id: uuid(), compliancePeriod }])
      } else {
        setRowData([{ id: uuid(), compliancePeriod }])
      }
      params.api.sizeColumnsToFit()

      setTimeout(() => {
        const lastRowIndex = params.api.getLastDisplayedRowIndex()
        params.api.startEditingCell({
          rowIndex: lastRowIndex,
          colKey: 'exportDate'
        })
        setGridReady(true)
      }, 500)
    },
    [compliancePeriod, data]
  )

  useEffect(() => {
    if (optionsData?.fuelTypes?.length > 0) {
      const updatedColumnDefs = fuelExportColDefs(
        optionsData,
        errors,
        warnings,
        gridReady
      )
      setColumnDefs(updatedColumnDefs)
    }
  }, [optionsData, errors, warnings, gridReady])

  useEffect(() => {
    if (!fuelExportsLoading && !isArrayEmpty(data)) {
      const updatedRowData = data.fuelExports.map((item) => ({
        ...item,
        fuelCategory: item.fuelCategory?.category,
        fuelType: item.fuelType?.fuelType,
        provisionOfTheAct: item.provisionOfTheAct?.name,
        fuelCode: item.fuelCode?.fuelCode,
        endUse: item.endUse?.type || 'Any',
        id: uuid(),
        compliancePeriod
      }))
      setRowData(updatedRowData)
    } else {
      setRowData([{ id: uuid() }])
    }
  }, [compliancePeriod, data, fuelExportsLoading])

  const onCellValueChanged = useCallback(
    async (params) => {
      if (params.column.colId === 'fuelTypeId') {
        const options = optionsData?.fuelTypes
          ?.find((obj) => params.node.data.fuelType === obj.fuelType)
          ?.fuelCategories.map((item) => item.fuelCategory)

        const categoryValue = options.length === 1 ? options[0] : null

        params.node.setDataValue('fuelCategoryId', categoryValue)
      }
    },
    [optionsData]
  )

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

      updatedData.compliancePeriod = compliancePeriod

      updatedData = await handleScheduleSave({
        alertRef,
        idField: 'fuelExportId',
        labelPrefix: 'fuelExport:fuelExportColLabels',
        params,
        setErrors,
        setWarnings,
        saveRow,
        t,
        updatedData
      })

      params.node.updateData(updatedData)
    },
    [saveRow, t, compliancePeriod]
  )

  const onAction = async (action, params) => {
    if (action === 'delete') {
      await handleScheduleDelete(
        params,
        'fuelExportId',
        saveRow,
        alertRef,
        setRowData,
        {}
      )
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

  return (
    isFetched &&
    !fuelExportsLoading && (
      <Grid2 className="add-edit-fuel-export-container" mx={-1}>
        <div className="header">
          <BCTypography variant="h5" color="primary">
            {t('fuelExport:addFuelExportRowsTitle')}
          </BCTypography>
          <BCTypography variant="body4" color="text" my={2} component="div">
            {t('fuelExport:fuelExportGuide')}
          </BCTypography>
        </div>
        <BCBox my={2} component="div" style={{ height: '100%', width: '100%' }}>
          <BCGridEditor
            gridRef={gridRef}
            alertRef={alertRef}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            rowData={rowData}
            gridOptions={gridOptions}
            loading={optionsLoading || fuelExportsLoading}
            onCellValueChanged={onCellValueChanged}
            onCellEditingStopped={onCellEditingStopped}
            showAddRowsButton={true}
            context={{ errors }}
            onAction={onAction}
            stopEditingWhenCellsLoseFocus
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
