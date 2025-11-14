import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import BCTypography from '@/components/BCTypography'
import {
  DEFAULT_CI_FUEL,
  NEW_REGULATION_YEAR,
  REPORT_SCHEDULES
} from '@/constants/common'
import { useGetComplianceReport } from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { buildPath, ROUTES } from '@/routes/routes'
import {
  useFuelSupplyOptions,
  useGetFuelSuppliesList,
  useSaveFuelSupply
} from '@/hooks/useFuelSupply'
import { cleanEmptyStringValues } from '@/utils/formatters'
import { handleScheduleDelete, handleScheduleSave } from '@/utils/schedules.js'
import {
  processFuelSupplyRowData,
  calculateColumnVisibility,
  updateGridColumnsVisibility,
  handleFuelTypeChange,
  handleFuelCategoryChange,
  validateFuelSupply,
  processCellEditingComplete,
  createGridOptions
} from './_utils'
import Grid2 from '@mui/material/Grid2'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import * as schema from './_schema'
// Legacy schema removed - all fuel supplies (including TFRS-migrated) use standard schema
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

  const gridOptions = useMemo(() => createGridOptions(t), [t])

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

  const processedRowData = useMemo(
    () =>
      processFuelSupplyRowData({
        fuelSupplyData,
        fuelSuppliesLoading,
        complianceReportId,
        compliancePeriod,
        isSupplemental
      }),
    [
      fuelSupplyData,
      fuelSuppliesLoading,
      complianceReportId,
      compliancePeriod,
      isSupplemental
    ]
  )

  const columnVisibility = useMemo(
    () => calculateColumnVisibility(rowData, optionsData, compliancePeriod),
    [rowData, optionsData, compliancePeriod]
  )

  const updateColumnsVisibility = useCallback(() => {
    updateGridColumnsVisibility(gridRef, columnVisibility)
  }, [columnVisibility])

  // Alert handling
  useEffect(() => {
    if (location?.state?.message) {
      alertRef.current?.triggerAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
    }
  }, [location?.state?.message, location?.state?.severity])

  // Set row data
  useEffect(() => {
    setRowData(processedRowData)
  }, [processedRowData])

  // Update column visibility
  useEffect(() => {
    const timeoutId = setTimeout(updateColumnsVisibility, 100)
    return () => clearTimeout(timeoutId)
  }, [updateColumnsVisibility])

  // Grid event handlers
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

  // All fuel supplies (including TFRS-migrated historical data) use the standard schema
  useEffect(() => {
    const updatedColumnDefs = schema.fuelSupplyColDefs(
      optionsData,
      errors,
      warnings,
      compliancePeriod,
      isSupplemental,
      isEarlyIssuance
    )
    setColumnDefs(updatedColumnDefs)
  }, [isSupplemental, isEarlyIssuance, errors, optionsData, warnings])

  const onFirstDataRendered = useCallback((params) => {
    params.api?.autoSizeAllColumns?.()
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

      if (colId === 'fuelType') {
        handleFuelTypeChange(params, optionsData, updateRowDataValues)
      }

      if (colId === 'fuelCategory') {
        handleFuelCategoryChange(params, optionsData, updateRowDataValues)
      }

      // Trigger column visibility update and auto-size
      setTimeout(() => {
        updateColumnsVisibility()
        params.api?.autoSizeAllColumns?.()
      }, 0)
    },
    [optionsData, updateColumnsVisibility, updateRowDataValues]
  )

  const onCellEditingStopped = useCallback(
    async (params) => {
      const updatedData = await processCellEditingComplete({
        params,
        validateFn: validateFuelSupply,
        alertRef,
        saveRow,
        t,
        setErrors,
        setWarnings
      })

      if (updatedData) {
        params.node.updateData(updatedData)
      }
    },
    [saveRow, t]
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
        {compliancePeriod >= NEW_REGULATION_YEAR ? (
          <>
            <BCTypography variant="body4" color="text" my={2} component="div">
              {t('fuelSupply:fuelSupplyGuide2025Later')}
            </BCTypography>
            <BCTypography variant="body4" color="text" my={2} component="div">
              {t('fuelSupply:fuelSupplyNote')}
            </BCTypography>
            <BCBox
              my={2}
              component="div"
              style={{ height: '100%', width: '100%' }}
            >
              <BCGridEditor
                gridRef={gridRef}
                alertRef={alertRef}
                columnDefs={columnDefs}
                defaultColDef={schema.defaultColDef}
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
          </>
        ) : (
          <>
            <BCTypography variant="body4" color="text" my={2} component="div">
              {t('fuelSupply:fuelSupplyGuide')}
            </BCTypography>
            <BCBox
              my={2}
              component="div"
              style={{ height: '100%', width: '100%' }}
            >
              <BCGridEditor
                gridRef={gridRef}
                alertRef={alertRef}
                columnDefs={columnDefs}
                defaultColDef={schema.defaultColDef}
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
          </>
        )}
      </div>
    </Grid2>
  )
}
