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
  const dateGridRef = useRef(null)
  const dateGridAlertRef = useRef(null)
  const previousSelectionRef = useRef(new Set())

  const { complianceReportId, compliancePeriod } = useParams()

  const minDate = `${compliancePeriod}-01-01`
  const maxDate = `${compliancePeriod}-12-31`

  const { data: siteNames = [], isLoading: siteLoading } = useSiteNames()

  // Get report data from store
  const reportData = useComplianceReportStore((state) =>
    state.getCachedReport(complianceReportId)
  )
  const [selectedSiteOption, setSelectedSiteOption] = useState(null)

  // Pagination state
  const [paginationOptions, setPaginationOptions] = useState({
    page: 1,
    size: 10,
    sortOrders: [],
    filters: []
  })

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
    complianceReportId,
    paginationOptions,
    {},
    reportData?.report?.organizationId
  )
  const { data, isLoading, isError } = queryData

  // Mutation hook for saving changes
  const { mutateAsync: saveRow } = useSaveFSEReporting(
    reportData?.report?.organizationId,
    complianceReportId
  )

  // Initialize previous selection when data loads
  useEffect(() => {
    if (isGridReady && dateGridRef.current?.api) {
      const initialSelection = new Set()
      dateGridRef.current.api.forEachNode((node) => {
        if (node.data.fseComplianceReportingId) {
          initialSelection.add(node.data.chargingEquipmentId)
        }
      })
      previousSelectionRef.current = initialSelection
    }
  }, [data, isGridReady])

  // Handle row selection changes
  const handleSelectionChanged = useCallback(
    async (api) => {
      const currentSelection = new Set()
      const selectedNodes = api.getSelectedNodes()

      // Build current selection set
      selectedNodes.forEach((node) => {
        currentSelection.add(node.data.chargingEquipmentId)
      })

      const previousSelection = previousSelectionRef.current

      // Find newly selected rows (unselected -> selected = CREATE)
      const newlySelected = [...currentSelection].filter(
        (id) => !previousSelection.has(id)
      )

      // Find newly unselected rows (selected -> unselected = DELETE)
      const newlyUnselected = [...previousSelection].filter(
        (id) => !currentSelection.has(id)
      )

      // Process deletions
      for (const equipmentId of newlyUnselected) {
        const node = api.getRowNode(equipmentId)
        if (node && node.data.fseComplianceReportingId) {
          try {
            dateGridAlertRef.current?.showAlert(
              'pending',
              t('finalSupplyEquipment:removingEquipment')
            )

            await saveRow({
              fseComplianceReportingId: node.data.fseComplianceReportingId,
              chargingEquipmentId: node.data.chargingEquipmentId,
              complianceReportId,
              organizationId: reportData?.report?.organizationId,
              deleted: true
            })

            // Update node to reflect deletion
            node.updateData({
              ...node.data,
              fseComplianceReportingId: null,
              complianceReportId: null,
              supplyFromDate: null,
              supplyToDate: null,
              kwhUsage: null,
              notes: null
            })

            dateGridAlertRef.current?.showAlert(
              'success',
              t('finalSupplyEquipment:equipmentRemoved')
            )
          } catch (error) {
            console.error('Error removing equipment:', error)
            dateGridAlertRef.current?.showAlert(
              'error',
              t('finalSupplyEquipment:errorRemovingEquipment')
            )
            // Revert selection on error
            api.setNodesSelected({ nodes: [node], newValue: true })
          }
        }
      }

      // Process additions (create new FSE compliance records)
      for (const equipmentId of newlySelected) {
        const node = api.getRowNode(equipmentId)
        if (node && !node.data.fseComplianceReportingId) {
          try {
            dateGridAlertRef.current?.showAlert(
              'pending',
              t('finalSupplyEquipment:addingEquipment')
            )

            const response = await saveRow({
              chargingEquipmentId: node.data.chargingEquipmentId,
              complianceReportId,
              organizationId: reportData?.report?.organizationId,
              supplyFromDate: defaultFromDate,
              supplyToDate: defaultToDate,
              kwhUsage: null,
              notes: null
            })

            // Update node with new FSE compliance reporting ID
            node.updateData({
              ...node.data,
              fseComplianceReportingId: response.data.fseComplianceReportingId,
              complianceReportId,
              supplyFromDate: defaultFromDate,
              supplyToDate: defaultToDate
            })

            dateGridAlertRef.current?.showAlert(
              'success',
              t('finalSupplyEquipment:equipmentAdded')
            )
          } catch (error) {
            console.error('Error adding equipment:', error)
            dateGridAlertRef.current?.showAlert(
              'error',
              t('finalSupplyEquipment:errorAddingEquipment')
            )
            // Revert selection on error
            api.setNodesSelected({ nodes: [node], newValue: false })
          }
        }
      }

      // Update previous selection reference
      previousSelectionRef.current = currentSelection

      // Clear alert after processing
      if (newlySelected.length === 0 && newlyUnselected.length === 0) {
        dateGridAlertRef.current?.clearAlert()
      }
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
    () => getFSEReportingColDefs(minDate, maxDate, errors, warnings),
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
        dateGridAlertRef.current?.showAlert(
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

      dateGridAlertRef.current?.showAlert(
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
          alertRef: dateGridAlertRef,
          idField: 'fseComplianceReportingId',
          labelPrefix: 'finalSupplyEquipment',
          params,
          setErrors,
          setWarnings,
          saveRow,
          t,
          updatedData
        })

        dateGridAlertRef.current?.clearAlert()
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
        dateGridAlertRef.current?.showAlert(
          'error',
          t('finalSupplyEquipment:errorSavingRow')
        )
      }
    },
    [saveRow, t, complianceReportId, reportData]
  )

  const onFirstDataRendered = useCallback((params) => {
    const nodesToSelect = []
    params.api.forEachNode((node) => {
      if (node.data.fseComplianceReportingId) {
        nodesToSelect.push(node)
      }
    })
    params.api.setNodesSelected({ nodes: nodesToSelect, newValue: true })
  }, [])

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

  const handleApplyToSelected = useCallback(() => {
    const selectedNodes = dateGridRef.current?.api.getSelectedNodes()
    if (!selectedNodes || selectedNodes.length === 0) {
      dateGridAlertRef.current?.showAlert(
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
      dateGridRef.current?.api.applyTransaction({ update: updates })
      dateGridAlertRef.current?.showAlert(
        'success',
        t('finalSupplyEquipment:datesAppliedToSelected')
      )
    }
  }, [defaultFromDate, defaultToDate, t])

  const handleApplyToAll = useCallback(() => {
    const allRowData = []
    dateGridRef.current?.api.forEachNode((node) => {
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
      dateGridRef.current?.api.applyTransaction({ update: allRowData })
      dateGridAlertRef.current?.showAlert(
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
    dateGridRef.current?.api.forEachNode((node) => {
      if (node.data.modified && node.data.fseComplianceReportingId) {
        modifiedRows.push(node.data)
      }
    })

    if (modifiedRows.length === 0) {
      dateGridAlertRef.current?.showAlert(
        'info',
        t('finalSupplyEquipment:noChangesToSave')
      )
      return
    }

    try {
      dateGridAlertRef.current?.showAlert(
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
      dateGridRef.current?.api.applyTransaction({ update: updates })

      dateGridAlertRef.current?.showAlert(
        'success',
        t('finalSupplyEquipment:changesSaved', {
          count: modifiedRows.length
        })
      )
    } catch (error) {
      console.error('Error saving modified rows:', error)
      dateGridAlertRef.current?.showAlert(
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
            onClick={handleApplyToSelected}
            disabled={!isDateRangeValid}
            sx={{ minWidth: 160, height: 40 }}
          >
            <BCTypography variant="body2">
              {t('finalSupplyEquipment:applyToSelected')}
            </BCTypography>
          </BCButton>
          <BCButton
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
          </BCButton>
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
        gridRef={dateGridRef}
        alertRef={dateGridAlertRef}
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
        onFirstDataRendered={onFirstDataRendered}
        onCellEditingStopped={handleCellEditingStopped}
        paginationOptions={paginationOptions}
        onPaginationChange={setPaginationOptions}
        paginationPageSizeSelector={[10, 25, 50, 100]}
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
