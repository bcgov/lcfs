import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import { DEFAULT_CI_FUEL } from '@/constants/common'
import * as ROUTES from '@/constants/routes/routes.js'
import {
  useFuelSupplyOptions,
  useGetFuelSupplies,
  useSaveFuelSupply
} from '@/hooks/useFuelSupply'
import { isArrayEmpty } from '@/utils/formatters'
import { Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { defaultColDef, fuelSupplyColDefs } from './_schema'

export const AddEditFuelSupplies = () => {
  const [rowData, setRowData] = useState([])
  const gridRef = useRef(null)
  const [, setGridApi] = useState()
  const [errors, setErrors] = useState({})
  const [warnings, setWarnings] = useState({})
  const [columnDefs, setColumnDefs] = useState([])
  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'fuelSupply', 'reports'])
  const params = useParams()
  const { complianceReportId, compliancePeriod } = params
  const navigate = useNavigate()

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

  const onGridReady = useCallback(
    async (params) => {
      setGridApi(params.api)
      if (!isArrayEmpty(data)) {
        const updatedRowData = data.fuelSupplies.map((item) => ({
          ...item,
          complianceReportId, // This takes current reportId, important for versioning
          compliancePeriod,
          fuelCategory: item.fuelCategory?.category,
          fuelType: item.fuelType?.fuelType,
          fuelTypeOther:
            item.fuelType?.fuelType === 'Other' ? item.fuelTypeOther : null,
          provisionOfTheAct: item.provisionOfTheAct?.name,
          fuelCode: item.fuelCode?.fuelCode,
          endUse: item.endUse?.type || 'Any',
          id: uuid()
        }))
        setRowData(updatedRowData)
      } else {
        setRowData([{ id: uuid() }])
      }
    },
    [data, complianceReportId, compliancePeriod]
  )

  useEffect(() => {
    if (optionsData?.fuelTypes?.length > 0) {
      const updatedColumnDefs = fuelSupplyColDefs(optionsData, errors, warnings)
      setColumnDefs(updatedColumnDefs)
    }
  }, [errors, warnings, optionsData])

  useEffect(() => {
    if (!fuelSuppliesLoading && !isArrayEmpty(data)) {
      const updatedRowData = data.fuelSupplies.map((item) => ({
        ...item,
        complianceReportId, // This takes current reportId, important for versioning
        compliancePeriod,
        fuelCategory: item.fuelCategory?.category,
        fuelType: item.fuelType?.fuelType,
        fuelTypeOther:
          item.fuelType?.fuelType === 'Other' ? item.fuelTypeOther : null,
        provisionOfTheAct: item.provisionOfTheAct?.name,
        fuelCode: item.fuelCode?.fuelCode,
        endUse: item.endUse?.type || 'Any',
        id: uuid()
      }))
      setRowData(updatedRowData)
    } else {
      setRowData([{ id: uuid() }])
    }
  }, [data, fuelSuppliesLoading, complianceReportId, compliancePeriod])

  const onCellValueChanged = useCallback(
    async (params) => {
      setWarnings({})
      if (params.column.colId === 'fuelType') {
        const selectedFuelType = optionsData?.fuelTypes?.find(
          (obj) => params.node.data.fuelType === obj.fuelType
        )
        if (selectedFuelType) {
          const fuelCategoryOptions = selectedFuelType.fuelCategories.map(
            (item) => item.fuelCategory
          )

          params.node.setDataValue(
            'fuelCategory',
            fuelCategoryOptions[0] ?? null
          )

          const fuelCodeOptions = selectedFuelType.fuelCodes.map(
            (code) => code.fuelCode
          )
          params.node.setDataValue('fuelCode', fuelCodeOptions[0] ?? null)
          params.node.setDataValue(
            'fuelCodeId',
            selectedFuelType.fuelCodes[0]?.fuelCodeId ?? null
          )
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

      let updatedData = params.node.data
      if (updatedData.fuelType === 'Other') {
        updatedData.ciOfFuel = DEFAULT_CI_FUEL[updatedData.fuelCategory]
      }
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
        const newWarnings = error.response.data.warnings
        if (newWarnings && newWarnings.length > 0) {
          setWarnings({
            [newWarnings[0].id]: newWarnings[0].fields
          })

          params.api.forEachNode((rowNode) => {
            if (rowNode.data.fuelSupplyId === newWarnings[0].id) {
              rowNode.updateData({
                ...rowNode.data,
                validationStatus: 'warning'
              })
            }
          })
        }

        const newErrors = error.response.data.errors
        setErrors({
          [params.node.data.id]: newErrors[0].fields
        })

        updatedData = {
          ...updatedData,
          validationStatus: 'error'
        }

        if (error.code === 'ERR_BAD_REQUEST') {
          const { fields, message } = newErrors[0]
          const fieldLabels = fields.map((field) =>
            t(`fuelSupply:fuelSupplyColLabels.${field}`)
          )

          // Only show field label if there is one
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
    !fuelSuppliesLoading && (
      <Grid2 className="add-edit-fuel-supply-container" mx={-1}>
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
            alertRef={alertRef}
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
