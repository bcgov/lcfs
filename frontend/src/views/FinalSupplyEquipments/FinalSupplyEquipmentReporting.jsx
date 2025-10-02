import BCBox from '@/components/BCBox'
import { BCGridEditorPaginated } from '@/components/BCDataGrid/BCGridEditorPaginated'
import BCTypography from '@/components/BCTypography'
import { Stack, TextField, Autocomplete } from '@mui/material'
import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Controller, useForm } from 'react-hook-form'
import { useParams } from 'react-router-dom'
import BCButton from '@/components/BCButton'
import { useSiteNames } from '@/hooks/useChargingSite'
import { getFSEReportingColDefs } from './_schema'
import {
  useGetFSEReportingList,
  useSaveFSEReporting
} from '@/hooks/useFinalSupplyEquipment'
import useComplianceReportStore from '@/stores/useComplianceReportStore'
import { handleScheduleSave } from '@/utils/schedules'

export const FinalSupplyEquipmentReporting = () => {
  const { t } = useTranslation()
  const [errors, setErrors] = useState({})
  const [warnings, setWarnings] = useState({})
  const [isGridReady, setGridReady] = useState(false)
  const [selectedSiteOption, setSelectedSiteOption] = useState(null)
  // Pagination state
  const [paginationOptions, setPaginationOptions] = useState({
    page: 1,
    size: 10,
    sortOrders: [],
    filters: []
  })
  const fseGridRef = useRef(null)
  const fseGridAlertRef = useRef(null)
  const previousSelectionRef = useRef(new Set())
  const globalSelectionRef = useRef(new Set())

  const { complianceReportId, compliancePeriod } = useParams()

  const minDate = `${compliancePeriod}-01-01`
  const maxDate = `${compliancePeriod}-12-31`

  const { data: siteNames = [], isLoading: siteLoading } = useSiteNames()

  // Get report data from store
  const reportData = useComplianceReportStore((state) =>
    state.getCachedReport(complianceReportId)
  )

  const { control, watch } = useForm({
    defaultValues: {
      defaultFromDate: minDate,
      defaultToDate: maxDate
    }
  })

  const defaultFromDate = watch('defaultFromDate')
  const defaultToDate = watch('defaultToDate')

  // Query hook for data fetching
  const queryData = useGetFSEReportingList(
    undefined, // retrieve all equipments related to the organization
    paginationOptions,
    {},
    reportData?.report?.organizationId
  )
  const { data, isLoading, isError, refetch } = queryData

  // Mutation hook for saving changes
  const { mutateAsync: saveRow } = useSaveFSEReporting(
    reportData?.report?.organizationId,
    complianceReportId
  )

  // Initialize global selection from all data when component loads
  useEffect(() => {
    if (data?.finalSupplyEquipments) {
      const globalSelection = new Set()
      data.finalSupplyEquipments.forEach((item) => {
        if (item.fseComplianceReportingId === complianceReportId) {
          globalSelection.add(item.chargingEquipmentId)
        }
      })
      globalSelectionRef.current = globalSelection
    }
  }, [data])

  // Update grid selection when page data changes
  useEffect(() => {
    if (isGridReady && fseGridRef.current?.api && data) {
      const currentPageSelection = new Set()
      const nodesToSelect = []

      fseGridRef.current.api.forEachNode((node) => {
        if (globalSelectionRef.current.has(node.data.chargingEquipmentId)) {
          nodesToSelect.push(node)
          currentPageSelection.add(node.data.chargingEquipmentId)
        }
      })

      fseGridRef.current.api.setNodesSelected({
        nodes: nodesToSelect,
        newValue: true
      })
      previousSelectionRef.current = currentPageSelection
    }
  }, [data, isGridReady, paginationOptions.page])

  // Handle row selection changes
  const handleSelectionChanged = useCallback(
    async (api) => {
      // TODO: yet to implement
      console.log('handleSelectionChanged', api)
    },
    [saveRow, complianceReportId, reportData, defaultFromDate, defaultToDate, t]
  )

  const gridOptions = useMemo(
    () => ({
      rowSelection: {
        checkboxes: true,
        mode: 'multiRow',
        headerCheckbox: true,
        isRowSelectable: (params) => true,
        enableClickSelection: false
      },
      selectionColumnDef: {
        suppressHeaderMenuButton: true,
        pinned: 'left'
      },
      onSelectionChanged: (event) => handleSelectionChanged(event.api),
      getRowId: (params) => params.data.chargingEquipmentId,
      stopEditingWhenCellsLoseFocus: false
    }),
    [handleSelectionChanged]
  )

  const columnDefs = useMemo(
    () =>
      getFSEReportingColDefs(
        minDate,
        maxDate,
        errors,
        warnings,
        complianceReportId
      ),
    [minDate, maxDate, errors, warnings]
  )

  const handleGridReady = useCallback(() => {
    setGridReady(true)
  }, [])

  // Handle individual cell edits with validation and saving
  const handleCellEditingStopped = useCallback(
    async (params) => {
      if (params.oldValue === params.newValue) return

      // Only allow edits on selected rows (rows with fseComplianceReportingId)
      if (!params.node.data.fseComplianceReportingId) {
        fseGridAlertRef.current?.showAlert(
          'warning',
          t('finalSupplyEquipment:selectRowToEdit')
        )
        return
      }

      // Update validation status to pending
      params.node.updateData({
        ...params.node.data,
        validationStatus: 'pending'
      })

      fseGridAlertRef.current?.showAlert(
        'pending',
        t('finalSupplyEquipment:updatingRow')
      )

      // Prepare data for save
      const updatedData = {
        ...Object.entries(params.node.data)
          .filter(
            ([, value]) => value !== null && value !== '' && value !== undefined
          )
          .reduce((acc, [key, value]) => {
            acc[key] = value
            return acc
          }, {}),
        complianceReportId,
        organizationId: reportData?.report?.organizationId
      }

      try {
        const responseData = await handleScheduleSave({
          alertRef: fseGridAlertRef,
          idField: 'fseComplianceReportingId',
          labelPrefix: 'finalSupplyEquipment',
          params,
          setErrors,
          setWarnings,
          saveRow,
          t,
          updatedData
        })

        fseGridAlertRef.current?.clearAlert()
        params.node.updateData({
          ...responseData,
          validationStatus: 'valid',
          modified: false
        })
        params.api?.autoSizeAllColumns?.()
      } catch (error) {
        console.error('Error saving FSE reporting data:', error)
        params.node.updateData({
          ...params.node.data,
          validationStatus: 'error'
        })
        fseGridAlertRef.current?.showAlert(
          'error',
          t('finalSupplyEquipment:errorSavingRow')
        )
      }
    },
    [saveRow, t, complianceReportId, reportData]
  )

  const handleSiteChange = useCallback((event, newValue) => {
    setSelectedSiteOption(newValue)
    // Update filters in pagination options
    setPaginationOptions((prev) => ({
      ...prev,
      page: 1,
      filters: newValue
        ? [{ field: 'chargingSiteId', value: newValue.chargingSiteId }]
        : []
    }))
  }, [])

  const handleSetDefaultValues = useCallback(() => {
    const selectedNodes = fseGridRef.current?.api.getSelectedNodes()
    if (!selectedNodes || selectedNodes.length === 0) {
      fseGridAlertRef.current?.showAlert(
        'warning',
        t('finalSupplyEquipment:noRowsSelected')
      )
      return
    }

    const updates = []
    selectedNodes.forEach((node) => {
      if (node.data.fseComplianceReportingId) {
        const updatedData = {
          ...node.data,
          supplyFromDate: defaultFromDate,
          supplyToDate: defaultToDate,
          modified: true
        }
        updates.push(updatedData)
      }
    })

    if (updates.length > 0) {
      const responseData = refetch()
    }
  }, [defaultFromDate, defaultToDate, t])

  const handleApplyToAll = useCallback(() => {
    const allRowData = []
    fseGridRef.current?.api.forEachNode((node) => {
      if (node.data.fseComplianceReportingId) {
        allRowData.push({
          ...node.data,
          supplyFromDate: defaultFromDate,
          supplyToDate: defaultToDate,
          modified: true
        })
      }
    })

    if (allRowData.length > 0) {
      fseGridRef.current?.api.applyTransaction({ update: allRowData })
      fseGridAlertRef.current?.showAlert(
        'success',
        t('finalSupplyEquipment:datesAppliedToAll')
      )
    }
  }, [defaultFromDate, defaultToDate, t])

  // Validate date range
  const isDateRangeValid = useMemo(() => {
    if (!defaultFromDate || !defaultToDate) return true
    return new Date(defaultFromDate) <= new Date(defaultToDate)
  }, [defaultFromDate, defaultToDate])

  const handleSaveAll = useCallback(async () => {
    const modifiedRows = []
    fseGridRef.current?.api.forEachNode((node) => {
      if (node.data.modified && node.data.fseComplianceReportingId) {
        modifiedRows.push(node.data)
      }
    })

    if (modifiedRows.length === 0) {
      fseGridAlertRef.current?.showAlert(
        'info',
        t('finalSupplyEquipment:noChangesToSave')
      )
      return
    }

    try {
      fseGridAlertRef.current?.showAlert(
        'pending',
        t('finalSupplyEquipment:savingChanges')
      )

      // Save all modified rows
      await Promise.all(
        modifiedRows.map((row) =>
          saveRow({
            ...row,
            complianceReportId,
            organizationId: reportData?.report?.organizationId
          })
        )
      )

      // Clear modified flags
      const updates = modifiedRows.map((row) => ({
        ...row,
        modified: false,
        validationStatus: 'valid'
      }))
      fseGridRef.current?.api.applyTransaction({ update: updates })

      fseGridAlertRef.current?.showAlert(
        'success',
        t('finalSupplyEquipment:changesSaved', {
          count: modifiedRows.length
        })
      )
    } catch (error) {
      console.error('Error saving modified rows:', error)
      fseGridAlertRef.current?.showAlert(
        'error',
        t('finalSupplyEquipment:errorSavingChanges')
      )
    }
  }, [t, saveRow, complianceReportId, reportData])

  return (
    <Stack className="fse-reporting-container" spacing={6}>
      <BCBox component="header" className="fse-header-container">
        <BCTypography
          variant="h5"
          color="primary"
          className="fse-header-title"
          gutterBottom
        >
          {t('finalSupplyEquipment:fseReportingTitle')}
        </BCTypography>
        <BCTypography variant="body4" color="text" className="fse-header-desc">
          {t('finalSupplyEquipment:fseReportingDesc')}
        </BCTypography>
      </BCBox>

      <BCBox
        component="section"
        className="fse-controls-container"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 3,
          flexWrap: { xs: 'wrap', lg: 'nowrap' }
        }}
      >
        {/* Left side: Date fields and buttons */}
        <BCBox
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'flex-start',
            flexWrap: 'wrap'
          }}
        >
          <Controller
            name="defaultFromDate"
            control={control}
            rules={{
              validate: (value) => {
                if (
                  value &&
                  defaultToDate &&
                  new Date(value) > new Date(defaultToDate)
                ) {
                  return t('finalSupplyEquipment:fromDateMustBeBeforeToDate')
                }
                return true
              }
            }}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                label={t('finalSupplyEquipment:defaultFromDate')}
                type="date"
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: minDate, max: maxDate }}
                size="small"
                sx={{ minWidth: 180 }}
                error={!!error || !isDateRangeValid}
                helperText={error?.message}
              />
            )}
          />

          <Controller
            name="defaultToDate"
            control={control}
            rules={{
              validate: (value) => {
                if (
                  value &&
                  defaultFromDate &&
                  new Date(value) < new Date(defaultFromDate)
                ) {
                  return t('finalSupplyEquipment:toDateMustBeAfterFromDate')
                }
                return true
              }
            }}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                label={t('finalSupplyEquipment:defaultToDate')}
                type="date"
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: minDate, max: maxDate }}
                size="small"
                sx={{ minWidth: 180 }}
                error={!!error || !isDateRangeValid}
                helperText={error?.message}
              />
            )}
          />

          <BCButton
            variant="outlined"
            size="medium"
            color="primary"
            onClick={handleSetDefaultValues}
            disabled={!isDateRangeValid}
            sx={{ minWidth: 160, height: 40 }}
          >
            <BCTypography variant="body2">
              {t('finalSupplyEquipment:setDefaultValues')}
            </BCTypography>
          </BCButton>
          {/* <BCButton
            variant="outlined"
            size="medium"
            color="primary"
            onClick={handleApplyToAll}
            disabled={!isDateRangeValid}
            sx={{ minWidth: 160, height: 40 }}
          >
            <BCTypography variant="body2">
              {t('finalSupplyEquipment:applyToAll')}
            </BCTypography>
          </BCButton> */}
        </BCBox>

        {/* Right side: Filter dropdown */}
        <BCBox
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            minWidth: 350
          }}
        >
          <BCTypography
            variant="body2"
            color="text.primary"
            sx={{ whiteSpace: 'nowrap' }}
          >
            {t('finalSupplyEquipment:showFSEFor')}
          </BCTypography>
          <Autocomplete
            disablePortal
            id="site-selector"
            loading={siteLoading}
            options={siteNames}
            value={selectedSiteOption}
            getOptionLabel={(option) => option.siteName}
            isOptionEqualToValue={(option, value) =>
              option.chargingSiteId === value.chargingSiteId
            }
            onChange={handleSiteChange}
            fullWidth
            sx={{
              minWidth: 250,
              '& .MuiOutlinedInput-root': {
                fontSize: '0.875rem'
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={t('finalSupplyEquipment:selectSiteName')}
                size="small"
              />
            )}
          />
        </BCBox>
      </BCBox>

      <BCGridEditorPaginated
        gridRef={fseGridRef}
        alertRef={fseGridAlertRef}
        gridKey="fse-reporting-grid"
        columnDefs={columnDefs}
        defaultColDef={{
          resizable: false,
          editable: true,
          singleClickEdit: true
        }}
        gridOptions={gridOptions}
        queryData={queryData}
        dataKey="finalSupplyEquipments"
        getRowId={(params) => String(params.data.chargingEquipmentId)}
        onGridReady={handleGridReady}
        onCellEditingStopped={handleCellEditingStopped}
        paginationOptions={paginationOptions}
        onPaginationChange={setPaginationOptions}
        enablePageCaching={true}
        showAddRowsButton={false}
        saveButtonProps={{
          enabled: true,
          text: t('finalSupplyEquipment:saveChanges'),
          confirmText: t('finalSupplyEquipment:saveConfirmation'),
          confirmLabel: t('finalSupplyEquipment:saveAnyway'),
          onSave: handleSaveAll
        }}
        autoSizeStrategy={{
          type: 'fitCellContents',
          defaultMinWidth: 100,
          defaultMaxWidth: 600
        }}
      />
    </Stack>
  )
}

FinalSupplyEquipmentReporting.displayName = 'FinalSupplyEquipmentReporting'
