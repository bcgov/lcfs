import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import { ROUTES } from '@/constants/routes'
import {
  useFuelExportOptions,
  useGetFuelExports,
  useSaveFuelExport
} from '@/hooks/useFuelExport'
import { isArrayEmpty } from '@/utils/formatters'
import { Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { defaultColDef, fuelExportColDefs } from './_schema'

export const AddEditFuelExports = () => {
  const [rowData, setRowData] = useState([])
  const gridRef = useRef(null)
  const [gridApi, setGridApi] = useState()
  const [errors, setErrors] = useState({})
  const [columnDefs, setColumnDefs] = useState([])
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
  const { mutateAsync: saveRow } = useSaveFuelExport(complianceReportId)

  const { data, isLoading: fuelExportsLoading } = useGetFuelExports({
    complianceReportId: +complianceReportId
  })

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
      setGridApi(params.api)
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
        setRowData(updatedRowData)
      } else {
        setRowData([{ id: uuid(), compliancePeriod }])
      }
      params.api.sizeColumnsToFit()
    },
    [compliancePeriod, data]
  )

  useEffect(() => {
    if (optionsData?.fuelTypes?.length > 0) {
      const updatedColumnDefs = fuelExportColDefs(optionsData, errors)
      setColumnDefs(updatedColumnDefs)
    }
  }, [errors, optionsData])

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
      if (params.column.colId === 'fuelType') {
        const options = optionsData?.fuelTypes
          ?.find((obj) => params.node.data.fuelType === obj.fuelType)
          ?.fuelCategories.map((item) => item.fuelCategory)
        if (options.length === 1) {
          params.node.setDataValue('fuelCategory', options[0])
        }
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
        setErrors({
          [params.node.data.id]: error.response.data.errors[0].fields
        })

        updatedData = {
          ...updatedData,
          validationStatus: 'error'
        }

        if (error.code === 'ERR_BAD_REQUEST') {
          const { fields, message } = error.response.data.errors[0]
          const fieldLabels = fields.map((field) =>
            t(`fuelExport:fuelExportColLabels.${field}`)
          )
          const errMsg = `Error updating row: ${
            fieldLabels.length === 1 ? fieldLabels[0] : ''
          } ${message}`

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
      if (updatedRow.fuelExportId) {
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
          <Typography variant="h5" color="primary">
            {t('fuelExport:addFuelExportRowsTitle')}
          </Typography>
          <Typography
            variant="body4"
            color="primary"
            sx={{ marginY: '2rem' }}
            component="div"
          >
            {t('fuelExport:fuelExportSubtitle')}
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
