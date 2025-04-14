import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import BCTypography from '@/components/BCTypography'
import { DEFAULT_CI_FUEL, REPORT_SCHEDULES } from '@/constants/common'
import { ROUTES, buildPath } from '@/routes/routes'
import { useGetComplianceReport } from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useFuelSupplyOptions,
  useGetFuelSuppliesList,
  useSaveFuelSupply
} from '@/hooks/useFuelSupply'
import { isArrayEmpty } from '@/utils/array.js'
import { cleanEmptyStringValues } from '@/utils/formatters'
import { changelogRowStyle } from '@/utils/grid/changelogCellStyle'
import { handleScheduleDelete, handleScheduleSave } from '@/utils/schedules.js'
import Grid2 from '@mui/material/Grid2'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { defaultColDef, fuelSupplyColDefs } from './_schema'
import { ComplianceReports } from '@/views/ComplianceReports/index.js'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'

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
  const { data: currentUser, isLoading: currentUserLoading } = useCurrentUser()
  const { data: complianceReport, isLoading: complianceReportLoading } =
    useGetComplianceReport(
      currentUser?.organization?.organizationId,
      complianceReportId,
      { enabled: !currentUserLoading }
    )

  const isSupplemental = complianceReport?.report?.version !== 0
  const isEarlyIssuance =
    complianceReport?.report?.reportingFrequency === REPORT_SCHEDULES.QUARTERLY

  const {
    data: optionsData,
    isLoading: optionsLoading,
    isFetched
  } = useFuelSupplyOptions({ compliancePeriod })

  const { mutateAsync: saveRow } = useSaveFuelSupply({ complianceReportId })

  const { data, isLoading: fuelSuppliesLoading } = useGetFuelSuppliesList({
    complianceReportId,
    changelog: isSupplemental
  })

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('fuelSupply:noFuelSuppliesFound'),
      autoSizeStrategy: {
        type: 'fitCellContents',
        defaultMinWidth: 50,
        defaultMaxWidth: 600
      },
      getRowStyle: (params) => changelogRowStyle(params, isSupplemental)
    }),
    [t, isSupplemental]
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
            isNewSupplementalEntry:
              isSupplemental && item.complianceReportId === +complianceReportId,
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
    [data, complianceReportId, compliancePeriod, isSupplemental]
  )

  useEffect(() => {
    const updatedColumnDefs = fuelSupplyColDefs(
      optionsData,
      errors,
      warnings,
      compliancePeriod,
      isSupplemental,
      isEarlyIssuance
    )
    setColumnDefs(updatedColumnDefs)
  }, [isSupplemental, isEarlyIssuance, errors, optionsData, warnings])

  useEffect(() => {
    if (!fuelSuppliesLoading && !isArrayEmpty(data)) {
      const updatedRowData = data.fuelSupplies.map((item) => {
        return {
          ...item,
          complianceReportId, // This takes current reportId, important for versioning
          compliancePeriod,
          isNewSupplementalEntry:
            isSupplemental && item.complianceReportId === +complianceReportId,
          id: uuid()
        }
      })

      setRowData(updatedRowData)
    } else {
      setRowData([{ id: uuid(), complianceReportId, compliancePeriod }])
    }
  }, [
    compliancePeriod,
    complianceReportId,
    data,
    fuelSuppliesLoading,
    isSupplemental
  ])

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
      buildPath(ROUTES.REPORTS.VIEW, {
        compliancePeriod,
        complianceReportId
      })
    )
  }, [navigate, compliancePeriod, complianceReportId])

  return (
    isFetched &&
    !fuelSuppliesLoading &&
    !currentUserLoading &&
    !complianceReportLoading && (
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
