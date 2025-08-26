import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import BCTypography from '@/components/BCTypography'
import {
  DEFAULT_CI_FUEL,
  DEFAULT_CI_FUEL_CODE,
  NEW_REGULATION_YEAR,
  REPORT_SCHEDULES
} from '@/constants/common'
import { buildPath, ROUTES } from '@/routes/routes'
import {
  useFuelSupplyOptions,
  useGetFuelSuppliesList,
  useSaveFuelSupply
} from '@/hooks/useFuelSupply'
import { isArrayEmpty } from '@/utils/array.js'
import { cleanEmptyStringValues } from '@/utils/formatters'
import { handleScheduleDelete, handleScheduleSave } from '@/utils/schedules.js'
import Grid2 from '@mui/material/Grid2'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { defaultColDef, fuelSupplyColDefs } from './_schema'
import { REPORT_SCHEDULES_VIEW } from '@/constants/statuses'
import { useComplianceReportWithCache } from '@/hooks/useComplianceReports'
import Loading from '@/components/Loading'

export const AddEditFuelSupplies = () => {
  const [rowData, setRowData] = useState([])
  const gridRef = useRef(null)
  const [, setGridApi] = useState()
  const [errors, setErrors] = useState({})
  const [warnings, setWarnings] = useState({})
  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'fuelSupply', 'reports'])
  const { complianceReportId, compliancePeriod } = useParams()
  const navigate = useNavigate()

  const { data: currentReport, isLoading } =
    useComplianceReportWithCache(complianceReportId)

  // Memoize derived values
  const reportState = useMemo(() => {
    if (!currentReport?.report)
      return { isSupplemental: false, isEarlyIssuance: false }

    return {
      isSupplemental: currentReport.report.version !== 0,
      isEarlyIssuance:
        currentReport.report.reportingFrequency === REPORT_SCHEDULES.QUARTERLY
    }
  }, [currentReport?.report])

  const { isSupplemental, isEarlyIssuance } = reportState

  const {
    data: optionsData,
    isLoading: optionsLoading,
    isFetched
  } = useFuelSupplyOptions({ compliancePeriod })

  const { mutateAsync: saveRow } = useSaveFuelSupply({ complianceReportId })

  const { data: fuelSupplyData, isLoading: fuelSuppliesLoading } =
    useGetFuelSuppliesList({
      complianceReportId,
      mode: isSupplemental
        ? REPORT_SCHEDULES_VIEW.EDIT
        : REPORT_SCHEDULES_VIEW.VIEW
    })
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

  const columnDefs = useMemo(
    () =>
      fuelSupplyColDefs(
        optionsData,
        errors,
        warnings,
        compliancePeriod,
        isSupplemental,
        isEarlyIssuance
      ),
    [
      optionsData,
      errors,
      warnings,
      compliancePeriod,
      isSupplemental,
      isEarlyIssuance
    ]
  )

  const processedRowData = useMemo(() => {
    if (fuelSuppliesLoading || !fuelSupplyData) return []

    const baseRowData = isArrayEmpty(fuelSupplyData)
      ? []
      : fuelSupplyData.fuelSupplies.map((item) => ({
          ...item,
          complianceReportId,
          compliancePeriod,
          isNewSupplementalEntry:
            isSupplemental && item.complianceReportId === +complianceReportId,
          id: uuid()
        }))

    return [
      ...baseRowData,
      { id: uuid(), complianceReportId, compliancePeriod }
    ]
  }, [
    fuelSupplyData,
    fuelSuppliesLoading,
    complianceReportId,
    compliancePeriod,
    isSupplemental
  ])

  const getColumnVisibility = useMemo(() => {
    if (!optionsData?.fuelTypes || isArrayEmpty(rowData)) {
      return {
        shouldShowIsCanadaProduced: false,
        shouldShowIsQ1Supplied: false
      }
    }

    let shouldShowIsCanadaProduced = false
    let shouldShowIsQ1Supplied = false
    const complianceYear = parseInt(compliancePeriod, 10)

    for (const row of rowData) {
      if (!row.fuelType) continue

      const fuelType = optionsData.fuelTypes.find(
        (obj) => row.fuelType === obj.fuelType
      )

      if (!fuelType) continue

      const isRenewable = fuelType.renewable
      let isCanadian = false

      if (row.fuelCode) {
        const fuelCodeDetails = fuelType.fuelCodes?.find(
          (fc) =>
            fc.fuelCode === row.fuelCode ||
            fc.fuelCode === row.fuelCode.replace('C-', '')
        )
        isCanadian = fuelCodeDetails?.fuelProductionFacilityCountry === 'Canada'
      }

      // Check conditions for showing columns
      if (
        (row.fuelCategory === 'Diesel' &&
          complianceYear >= NEW_REGULATION_YEAR &&
          isRenewable &&
          row.provisionOfTheAct === DEFAULT_CI_FUEL_CODE) ||
        isCanadian
      ) {
        shouldShowIsCanadaProduced = true
      }

      if (
        row.fuelCategory === 'Diesel' &&
        complianceYear === NEW_REGULATION_YEAR &&
        isRenewable &&
        !isCanadian &&
        row.provisionOfTheAct != DEFAULT_CI_FUEL_CODE
      ) {
        shouldShowIsQ1Supplied = true
      }

      // Early exit if both conditions are met
      if (shouldShowIsCanadaProduced && shouldShowIsQ1Supplied) break
    }

    return { shouldShowIsCanadaProduced, shouldShowIsQ1Supplied }
  }, [rowData, optionsData, compliancePeriod])

  const updateGridColumnsVisibility = useCallback(() => {
    const api = gridRef.current?.api
    if (!api) return

    const { shouldShowIsCanadaProduced, shouldShowIsQ1Supplied } =
      getColumnVisibility

    // Only update if visibility actually changed
    const currentIsCanadaProduced = api
      .getColumn('isCanadaProduced')
      ?.isVisible()
    const currentIsQ1Supplied = api.getColumn('isQ1Supplied')?.isVisible()

    if (currentIsCanadaProduced !== shouldShowIsCanadaProduced) {
      api.setColumnsVisible(['isCanadaProduced'], shouldShowIsCanadaProduced)
    }

    if (currentIsQ1Supplied !== shouldShowIsQ1Supplied) {
      api.setColumnsVisible(['isQ1Supplied'], shouldShowIsQ1Supplied)
    }
  }, [getColumnVisibility])

  useEffect(() => {
    if (location?.state?.message) {
      alertRef.current?.triggerAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
    }
  }, [location?.state?.message, location?.state?.severity])

  useEffect(() => {
    setRowData(processedRowData)
  }, [processedRowData])

  useEffect(() => {
    const timeoutId = setTimeout(updateGridColumnsVisibility, 100)
    return () => clearTimeout(timeoutId)
  }, [updateGridColumnsVisibility])

  const validate = useCallback(
    (params, validationFn, errorMessage, alertRef, field = null) => {
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
      return true
    },
    []
  )

  const onGridReady = useCallback(async (params) => {
    setGridApi(params.api)

    // Start editing the last row after a brief delay
    setTimeout(() => {
      const lastRowIndex = params.api.getLastDisplayedRowIndex()
      if (lastRowIndex >= 0) {
        params.api.startEditingCell({
          rowIndex: lastRowIndex,
          colKey: 'fuelType'
        })
      }
    }, 100)
  }, [])

  const onFirstDataRendered = useCallback((params) => {
    params.api.autoSizeAllColumns()
  }, [])

  const updateRowDataValues = useCallback((node, updates) => {
    Object.entries(updates).forEach(([key, value]) => {
      node.setDataValue(key, value)
    })
  }, [])

  const onCellValueChanged = useCallback(
    async (params) => {
      setWarnings({})
      const { colId } = params.column
      const { node } = params

      if (colId === 'fuelType') {
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

          updateRowDataValues(node, {
            fuelCategory:
              fuelCategoryOptions.length === 1 ? fuelCategoryOptions[0] : null,
            endUseType: endUseTypes.length === 1 ? endUseTypes[0].type : null,
            provisionOfTheAct:
              selectedFuelType.provisions.length === 1
                ? selectedFuelType.provisions[0].name
                : null,
            isCanadaProduced: false,
            isQ1Supplied: false
          })
        }
      }

      if (colId === 'fuelCategory') {
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

          updateRowDataValues(node, {
            endUseType: endUseTypes.length === 1 ? endUseTypes[0].type : null,
            provisionOfTheAct:
              selectedFuelType.provisions.length === 1
                ? selectedFuelType.provisions[0].name
                : null,
            isCanadaProduced: false,
            isQ1Supplied: false
          })
        }
      }

      // Trigger column visibility update and auto-size
      setTimeout(() => {
        updateGridColumnsVisibility()
        params.api.autoSizeAllColumns()
      }, 0)
    },
    [optionsData, updateGridColumnsVisibility, updateRowDataValues]
  )

  const onCellEditingStopped = useCallback(
    async (params) => {
      if (params.oldValue === params.newValue) return

      const isValid = validate(
        params,
        (value) => value !== null && !isNaN(value) && value > 0,
        'Quantity supplied must be greater than 0.',
        alertRef,
        'quantity'
      )

      if (!isValid) return

      params.node.updateData({
        ...params.node.data,
        validationStatus: 'pending'
      })
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
    [saveRow, t, validate]
  )

  const onAction = useCallback(
    async (action, params) => {
      try {
        if (action === 'delete' || action === 'undo') {
          const success = await handleScheduleDelete(
            params,
            'fuelSupplyId',
            saveRow,
            alertRef,
            setRowData,
            { complianceReportId, compliancePeriod }
          )

          // Clear validation status
          if (success) {
            params.api.forEachNode((rowNode) => {
              rowNode.updateData({
                ...rowNode.data,
                validationStatus: undefined
              })
            })
          }
        }
      } catch (error) {
        console.error('Error handling action:', error)
      }
    },
    [saveRow, complianceReportId, compliancePeriod]
  )

  const handleNavigateBack = useCallback(() => {
    navigate(
      buildPath(ROUTES.REPORTS.VIEW, {
        compliancePeriod,
        complianceReportId
      }),
      {
        state: {
          expandedSchedule: 'fuelSupplies',
          message: t('fuelSupply:scheduleUpdated'),
          severity: 'success'
        }
      }
    )
  }, [navigate, compliancePeriod, complianceReportId, t])

  if (!isFetched || fuelSuppliesLoading || isLoading) {
    return <Loading />
  }

  return (
    <Grid2 className="add-edit-fuel-supply-container" mx={-1}>
      <div className="header">
        <BCTypography variant="h5" color="primary">
          {t('fuelSupply:fuelSupplyTitle')}
        </BCTypography>
        <BCTypography variant="body4" color="text" my={2} component="div">
          {t('fuelSupply:fuelSupplyGuide')}
        </BCTypography>
        {compliancePeriod >= NEW_REGULATION_YEAR && (
          <BCTypography variant="body4" color="text" my={2} component="div">
            {t('fuelSupply:fuelSupplyNote')}
          </BCTypography>
        )}
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
          onFirstDataRendered={onFirstDataRendered}
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
}
