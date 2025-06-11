import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { ROUTES, buildPath } from '@/routes/routes'
import { useComplianceReportWithCache } from '@/hooks/useComplianceReports'
import {
  useGetAllOtherUsesList,
  useOtherUsesOptions,
  useSaveOtherUses
} from '@/hooks/useOtherUses'
import { cleanEmptyStringValues } from '@/utils/formatters'
import { changelogRowStyle } from '@/utils/grid/changelogCellStyle'
import { handleScheduleDelete, handleScheduleSave } from '@/utils/schedules.js'
import Grid2 from '@mui/material/Grid2'
import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import {
  defaultColDef,
  otherUsesColDefs,
  PROVISION_APPROVED_FUEL_CODE
} from './_schema'

export const AddEditOtherUses = () => {
  const [rowData, setRowData] = useState([])
  const [errors, setErrors] = useState({})
  const [warnings, setWarnings] = useState({})

  const gridRef = useRef(null)
  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'otherUses', 'reports'])
  const { complianceReportId, compliancePeriod } = useParams()

  const {
    data: optionsData,
    isLoading: optionsLoading,
    isFetched
  } = useOtherUsesOptions({ compliancePeriod })

  const { mutateAsync: saveRow } = useSaveOtherUses(complianceReportId)
  const navigate = useNavigate()

  const { data: complianceReport, isLoading: complianceReportLoading } =
    useComplianceReportWithCache(complianceReportId)

  const { data: otherUses, isLoading: usesLoading } = useGetAllOtherUsesList({
    complianceReportId,
    changelog: complianceReport?.report?.version !== 0
  })

  const isSupplemental = useMemo(
    () => complianceReport?.report?.version !== 0,
    [complianceReport?.report?.version]
  )

  const numericComplianceReportId = useMemo(
    () => +complianceReportId,
    [complianceReportId]
  )

  // Utility function to ensure consistent row ID assignment
  const ensureRowId = useCallback(
    (row) => {
      if (row.id) return row

      return {
        ...row,
        id: uuid(),
        isValid: true,
        complianceReportId: numericComplianceReportId,
        ...(isSupplemental &&
          row.complianceReportId === numericComplianceReportId && {
            isNewSupplementalEntry: true
          })
      }
    },
    [numericComplianceReportId, isSupplemental]
  )

  const processRowData = useCallback(
    (data) => {
      if (!data?.length) {
        return [
          {
            id: uuid(),
            complianceReportId: numericComplianceReportId,
            compliancePeriod,
            isValid: true
          }
        ]
      }

      const processedData = data.map((item) => ({
        ...ensureRowId(item),
        complianceReportId: numericComplianceReportId,
        isNewSupplementalEntry:
          isSupplemental &&
          item.complianceReportId === numericComplianceReportId
      }))

      return processedData
    },
    [ensureRowId, numericComplianceReportId, compliancePeriod, isSupplemental]
  )

  // Handle location state alerts
  useEffect(() => {
    if (location.state?.message) {
      alertRef.current?.triggerAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
    }
  }, [location.state])

  // Initialize and update row data
  useEffect(() => {
    if (usesLoading || !isFetched) return

    try {
      const processedData = [
        ...processRowData(otherUses),
        {
          id: uuid(),
          complianceReportId: numericComplianceReportId,
          compliancePeriod,
          isValid: true
        }
      ]
      setRowData(processedData)
    } catch (error) {
      console.error('Error processing row data:', error)
      alertRef.current?.triggerAlert({
        message: t('otherUses:otherUsesLoadFailMsg'),
        severity: 'error'
      })
      // Fallback to empty row
      setRowData([
        {
          id: uuid(),
          complianceReportId: numericComplianceReportId,
          compliancePeriod,
          isValid: true
        }
      ])
    }
  }, [
    otherUses,
    usesLoading,
    isFetched,
    processRowData,
    t,
    numericComplianceReportId,
    compliancePeriod
  ])

  const findCiOfFuel = useCallback((data, optionsData) => {
    if (!optionsData?.fuelTypes || !data.fuelType) return 0

    const fuelType = optionsData.fuelTypes.find(
      (obj) => data.fuelType === obj.fuelType
    )

    if (!fuelType) return 0

    if (data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE) {
      const fuelCode = fuelType.fuelCodes?.find(
        (item) => item.fuelCode === data.fuelCode
      )
      return fuelCode?.carbonIntensity || 0
    }

    return fuelType.defaultCarbonIntensity || 0
  }, [])

  const validate = useCallback(
    (params, validationFn, errorMessage, field = null) => {
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

  const onGridReady = useCallback(
    (params) => {
      if (!params?.api) return

      try {
        params.api.sizeColumnsToFit()

        // Auto-focus the first editable cell after data is loaded
        setTimeout(() => {
          const lastRowIndex = params.api.getLastDisplayedRowIndex()
          if (lastRowIndex >= 0) {
            params.api.startEditingCell({
              rowIndex: lastRowIndex,
              colKey: 'fuelType'
            })
          }
        }, 100)
      } catch (error) {
        console.error('Error in onGridReady:', error)
        alertRef.current?.triggerAlert({
          message: t('otherUses:otherUsesLoadFailMsg'),
          severity: 'error'
        })
      }
    },
    [t]
  )

  const onAction = useCallback(
    async (action, params) => {
      if (action === 'delete' || action === 'undo') {
        await handleScheduleDelete(
          params,
          'otherUsesId',
          saveRow,
          alertRef,
          setRowData,
          { complianceReportId: numericComplianceReportId }
        )
      }
    },
    [saveRow, numericComplianceReportId]
  )

  const updateNodeData = useCallback((node, field, value) => {
    if (node?.setDataValue) {
      node.setDataValue(field, value)
    }
  }, [])

  const onCellValueChanged = useCallback(
    async (params) => {
      if (
        !['fuelType', 'fuelCode', 'provisionOfTheAct'].includes(
          params.colDef.field
        )
      ) {
        return
      }

      const fuelType = optionsData?.fuelTypes?.find(
        (obj) => params.data.fuelType === obj.fuelType
      )

      if (!fuelType) return

      const ciOfFuel = findCiOfFuel(params.data, optionsData)
      updateNodeData(params.node, 'ciOfFuel', ciOfFuel)

      // Auto-populate fields based on the selected fuel type
      if (params.colDef.field === 'fuelType') {
        // Auto-populate units
        updateNodeData(params.node, 'units', fuelType.units || '')

        // Auto-populate fuel category
        const fuelCategoryOptions =
          fuelType.fuelCategories?.map((item) => item.category) || []
        const categoryValue =
          fuelCategoryOptions.length === 1 ? fuelCategoryOptions[0] : null
        updateNodeData(params.node, 'fuelCategory', categoryValue)

        // Auto-populate provision of the act
        const provisions =
          fuelType.provisionOfTheAct?.map((provision) => provision.name) || []
        const provisionValue = provisions.length === 1 ? provisions[0] : null
        updateNodeData(params.node, 'provisionOfTheAct', provisionValue)
      }

      // Auto-populate fuel code for approved fuel code scenarios
      if (params.node.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE) {
        const fuelCodeOptions =
          fuelType.fuelCodes?.map((code) => code.fuelCode) || []
        if (fuelCodeOptions.length === 1) {
          updateNodeData(params.node, 'fuelCode', fuelCodeOptions[0] || null)
          updateNodeData(
            params.node,
            'fuelCodeId',
            fuelType.fuelCodes[0]?.fuelCodeId || null
          )
        }
      }
    },
    [optionsData, findCiOfFuel, updateNodeData]
  )

  const onCellEditingStopped = useCallback(
    async (params) => {
      if (params.oldValue === params.newValue) return

      const isValid = validate(
        params,
        (value) => value !== null && !isNaN(value) && value > 0,
        'Quantity supplied must be greater than 0.',
        'quantitySupplied'
      )

      if (!isValid) return

      params.data.complianceReportId = numericComplianceReportId
      params.data.validationStatus = 'pending'

      alertRef.current?.triggerAlert({
        message: 'Updating row...',
        severity: 'pending'
      })

      try {
        let updatedData = cleanEmptyStringValues(params.data)

        updatedData = await handleScheduleSave({
          alertRef,
          idField: 'otherUsesId',
          labelPrefix: 'otherUses:otherUsesColLabels',
          params,
          setErrors,
          setWarnings,
          saveRow,
          t,
          updatedData
        })

        params.node.updateData(updatedData)
      } catch (error) {
        console.error('Error saving row:', error)
        alertRef.current?.triggerAlert({
          message: t('common:saveError'),
          severity: 'error'
        })
      }
    },
    [numericComplianceReportId, saveRow, t, validate]
  )

  const handleNavigateBack = useCallback(() => {
    navigate(
      buildPath(ROUTES.REPORTS.VIEW, {
        compliancePeriod,
        complianceReportId
      })
    )
  }, [navigate, compliancePeriod, complianceReportId])

  const columnDefs = useMemo(
    () => otherUsesColDefs(optionsData, errors, warnings, isSupplemental),
    [optionsData, errors, warnings, isSupplemental]
  )

  const gridOptions = useMemo(
    () => ({
      getRowStyle: (params) => changelogRowStyle(params, isSupplemental)
    }),
    [isSupplemental]
  )

  const saveButtonProps = useMemo(
    () => ({
      enabled: true,
      text: t('report:saveReturn'),
      onSave: handleNavigateBack,
      confirmText: t('report:incompleteReport'),
      confirmLabel: t('report:returnToReport')
    }),
    [t, handleNavigateBack]
  )

  const autoSizeStrategy = useMemo(
    () => ({
      type: 'fitGridWidth',
      defaultMinWidth: 50,
      defaultMaxWidth: 600
    }),
    []
  )

  // Show loading state
  if (optionsLoading || usesLoading || complianceReportLoading) {
    return <Loading />
  }

  return (
    <Grid2 className="add-edit-other-uses-container" mx={-1}>
      <div className="header">
        <BCTypography variant="h5" color="primary">
          {t('otherUses:newOtherUsesTitle')}
        </BCTypography>
        <BCTypography variant="body4" color="text" my={2} component="div">
          {t('otherUses:newOtherUsesGuide')}
        </BCTypography>
      </div>

      <BCGridEditor
        gridRef={gridRef}
        alertRef={alertRef}
        getRowId={(params) => params.data.id}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onGridReady={onGridReady}
        rowData={rowData}
        autoSizeStrategy={autoSizeStrategy}
        overlayNoRowsTemplate={t('otherUses:noOtherUsesFound')}
        loading={optionsLoading || usesLoading}
        onAction={onAction}
        onCellValueChanged={onCellValueChanged}
        onCellEditingStopped={onCellEditingStopped}
        showAddRowsButton
        stopEditingWhenCellsLoseFocus
        saveButtonProps={saveButtonProps}
        gridOptions={gridOptions}
      />
    </Grid2>
  )
}
