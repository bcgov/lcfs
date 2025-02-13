import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import { DEFAULT_CI_FUEL } from '@/constants/common'
import * as ROUTES from '@/constants/routes/routes.js'
import {
  useFuelSupplyOptions,
  useGetFuelSupplies,
  useGetFuelSuppliesList,
  useSaveFuelSupply
} from '@/hooks/useFuelSupply'
import { cleanEmptyStringValues } from '@/utils/formatters'
import BCTypography from '@/components/BCTypography'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { defaultColDef, fuelSupplyColDefs } from './_schema'
import { handleScheduleDelete, handleScheduleSave } from '@/utils/schedules.js'
import { isArrayEmpty } from '@/utils/array.js'
import { useGetComplianceReport } from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import colors from '@/themes/base/colors'

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
  const { data: currentUser } = useCurrentUser()
  const { data: complianceReport } = useGetComplianceReport(
    currentUser?.organization.organizationId,
    complianceReportId
  )

  const isSupplemental = complianceReport?.report.version !== 0

  const {
    data: optionsData,
    isLoading: optionsLoading,
    isFetched
  } = useFuelSupplyOptions({ compliancePeriod })

  const { mutateAsync: saveRow } = useSaveFuelSupply({ complianceReportId })

  const { data, isLoading: fuelSuppliesLoading } = useGetFuelSuppliesList({
    complianceReportId,
    changelog: true
  })

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('fuelSupply:noFuelSuppliesFound'),
      autoSizeStrategy: {
        type: 'fitCellContents',
        defaultMinWidth: 50,
        defaultMaxWidth: 600
      },
      getRowStyle: (params) => {
        if (params.data.actionType === 'CREATE' && params.data.isNewEntry) {
          return {
            backgroundColor: colors.alerts.success.background
          }
        }
        if (params.data.actionType === 'UPDATE' && params.data.isNewEntry) {
          return {
            backgroundColor: colors.alerts.warning.background
          }
        }
        if (params.data.actionType === 'DELETE' && params.data.isNewEntry) {
          return {
            backgroundColor: colors.alerts.error.background
          }
        }
      }
    }),
    [t]
  )

  useEffect(() => {
    if (location?.state?.message) {
      alertRef.current?.triggerAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
    }
  }, [location?.state?.message, location?.state?.severity])

  const validate = (
    params,
    validationFn,
    errorMessage,
    alertRef,
    field = null
  ) => {
    const value = field ? params.node?.data[field] : params

    if (field && params.colDef.field !== field) {
      return true
    }

    if (!validationFn(value)) {
      alertRef.current?.triggerAlert({
        message: errorMessage,
        severity: 'error'
      })
      return false
    }
    return true // Proceed with the update
  }

  const onGridReady = useCallback(
    async (params) => {
      setGridApi(params.api)
      if (!isArrayEmpty(data)) {
        const updatedRowData = data.fuelSupplies.map((item) => {
          return {
            ...item,
            complianceReportId, // This takes current reportId, important for versioning
            compliancePeriod,
            fuelCategory: item.fuelCategory?.category,
            fuelType: item.fuelType?.fuelType,
            fuelTypeOther:
              item.fuelType?.fuelType === 'Other' ? item.fuelTypeOther : null,
            provisionOfTheAct: item.provisionOfTheAct?.name,
            provisionOfTheActId: item.provisionOfTheActId,
            fuelCode: item.fuelCode?.fuelCode,
            endUse: item.endUse?.type,
            isNewEntry: item.complianceReportId === +complianceReportId,
            id: uuid()
          }
        })
        setRowData([...updatedRowData, { id: uuid() }])
      } else {
        setRowData([{ id: uuid(), complianceReportId, compliancePeriod }])
      }
      setTimeout(() => {
        const lastRowIndex = params.api.getLastDisplayedRowIndex()
        params.api.startEditingCell({
          rowIndex: lastRowIndex,
          colKey: 'fuelType'
        })
      }, 100)
    },
    [data, complianceReportId, compliancePeriod]
  )

  useEffect(() => {
    if (optionsData?.fuelTypes?.length > 0) {
      const updatedColumnDefs = fuelSupplyColDefs(
        optionsData,
        errors,
        warnings,
        isSupplemental,
        complianceReport?.report.version
      )
      setColumnDefs(updatedColumnDefs)
    }
  }, [
    errors,
    warnings,
    optionsData,
    isSupplemental,
    complianceReport?.report.version
  ])

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
        provisionOfTheActId: item.provisionOfTheAct?.provisionOfTheActId,
        fuelCode: item.fuelCode?.fuelCode,
        endUse: item.endUse?.type,
        isNewEntry: item.complianceReportId === +complianceReportId,
        id: uuid()
      }))
      setRowData(updatedRowData)
    } else {
      setRowData([{ id: uuid(), complianceReportId, compliancePeriod }])
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

          const endUseTypes = selectedFuelType.eerRatios.map(
            (item) => item.endUseType
          )

          // Set to null if multiple options, otherwise use first item
          const categoryValue =
            fuelCategoryOptions.length === 1 ? fuelCategoryOptions[0] : null
          const endUseValue =
            endUseTypes.length === 1 ? endUseTypes[0].type : null
          const provisionValue =
            selectedFuelType.provisions.length === 1
              ? selectedFuelType.provisions[0].name
              : null

          params.node.setDataValue('fuelCategory', categoryValue)
          params.node.setDataValue('endUseType', endUseValue)
          params.node.setDataValue('provisionOfTheAct', provisionValue)
        }
      }

      if (params.column.colId === 'fuelCategory') {
        const selectedFuelType = optionsData?.fuelTypes?.find(
          (obj) => params.node.data.fuelType === obj.fuelType
        )

        if (selectedFuelType) {
          const endUseTypes = selectedFuelType.eerRatios
            .filter(
              (item) =>
                item.fuelCategory.fuelCategory === params.data.fuelCategory
            )
            .map((item) => item.endUseType)

          // Set to null if multiple options, otherwise use first item
          const endUseValue =
            endUseTypes.length === 1 ? endUseTypes[0].type : null
          const provisionValue =
            selectedFuelType.provisions.length === 1
              ? selectedFuelType.provisions[0].name
              : null

          params.node.setDataValue('endUseType', endUseValue)
          params.node.setDataValue('provisionOfTheAct', provisionValue)
        }
      }
    },
    [optionsData]
  )

  const onCellEditingStopped = useCallback(
    async (params) => {
      if (params.oldValue === params.newValue) return

      const isValid = validate(
        params,
        (value) => {
          return value !== null && !isNaN(value) && value > 0
        },
        'Quantity supplied must be greater than 0.',
        alertRef,
        'quantity'
      )

      if (!isValid) {
        return
      }

      params.node.updateData({
        ...params.node.data,
        validationStatus: 'pending'
      })

      alertRef.current?.triggerAlert({
        message: 'Updating row...',
        severity: 'pending'
      })

      // clean up any null or empty string values
      let updatedData = cleanEmptyStringValues(params.node.data)

      if (updatedData.fuelType === 'Other') {
        updatedData.ciOfFuel = DEFAULT_CI_FUEL[updatedData.fuelCategory]
      }

      updatedData = await handleScheduleSave({
        alertRef,
        idField: 'fuelSupplyId',
        labelPrefix: 'fuelSupply:fuelSupplyColLabels',
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
    if (action === 'delete' || action === 'undo') {
      await handleScheduleDelete(
        params,
        'fuelSupplyId',
        saveRow,
        alertRef,
        setRowData,
        {
          complianceReportId,
          compliancePeriod
        }
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
    !fuelSuppliesLoading && (
      <Grid2 className="add-edit-fuel-supply-container" mx={-1}>
        <div className="header">
          <BCTypography variant="h5" color="primary">
            {t('fuelSupply:fuelSupplyTitle')}
          </BCTypography>
          <BCTypography variant="body4" color="text" my={2} component="div">
            {t('fuelSupply:fuelSupplyGuide')}
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
