import BCBox from '@/components/BCBox'
import { BCGridEditorPaginated } from '@/components/BCDataGrid/BCGridEditorPaginated'
import BCTypography from '@/components/BCTypography'
import { Stack, TextField, Autocomplete } from '@mui/material'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Controller, useForm } from 'react-hook-form'
import { useParams } from 'react-router-dom'
import BCButton from '@/components/BCButton'
import { useSiteNames } from '@/hooks/useChargingSite'
import { useQuery } from '@tanstack/react-query'
import { getFSEReportingColDefs } from './_schema'
import { useGetFSEReportingList } from '@/hooks/useFinalSupplyEquipment'
import useComplianceReportStore from '@/stores/useComplianceReportStore'

export const FinalSupplyEquipmentReporting = () => {
  const { t } = useTranslation()
  const [errors, setErrors] = useState({})
  const [warnings, setWarnings] = useState({})
  const [isGridReady, setGridReady] = useState(false)
  const dateGridRef = useRef(null)
  const dateGridAlertRef = useRef(null)

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
  // Handle row selection for bulk operations
  const handleSelectionChanged = useCallback((api) => {
    const selectedNodes = api.getSelectedNodes()
    const selectedIds = selectedNodes.map(
      (node) => node.data.fseComplianceReportingId
    )
    setSelectedRows(selectedIds)
  }, [])

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
      getRowId: (params) => params.data.chargingEquipmentId
    }),
    [handleSelectionChanged]
  )

  const columnDefs = useMemo(
    () => getFSEReportingColDefs(minDate, maxDate, errors, warnings),
    [t, minDate, maxDate]
  )

  const handleGridReady = useCallback(() => {
    setGridReady(true)
  }, [])

  const handleCellEditingStopped = useCallback((params) => {
    // Handle saving edited cell data
    console.log('Cell edited:', params.data)
    // TODO: Make API call to save changes
    // Example: updateFSERecord(params.data.id, params.data)
  }, [])

  const onFirstDataRendered = useCallback((params) => {
    const nodesToSelect = []
    params.api.forEachNode((node) => {
      if (node.data.complianceReportId) {
        nodesToSelect.push(node)
      }
    })
    params.api.setNodesSelected({ nodes: nodesToSelect, newValue: true })
  }, [])

  const handleSiteChange = useCallback((event, newValue) => {
    setSelectedSiteOption(newValue)
    // Reset to first page when filter changes
    setPaginationOptions((prev) => ({ ...prev, page: 1 }))
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
      const updatedData = {
        ...node.data,
        supplyFromDate: defaultFromDate,
        supplyToDate: defaultToDate,
        modified: true
      }
      updates.push(updatedData)
    })

    dateGridRef.current?.api.applyTransaction({ update: updates })
    dateGridAlertRef.current?.showAlert(
      'success',
      t('finalSupplyEquipment:datesAppliedToSelected')
    )
  }, [defaultFromDate, defaultToDate, t])

  const handleApplyToAll = useCallback(() => {
    const allRowData = []
    dateGridRef.current?.api.forEachNode((node) => {
      allRowData.push({
        ...node.data,
        supplyFromDate: defaultFromDate,
        supplyToDate: defaultToDate,
        modified: true
      })
    })

    dateGridRef.current?.api.applyTransaction({ update: allRowData })
    dateGridAlertRef.current?.showAlert(
      'success',
      t('finalSupplyEquipment:datesAppliedToAll')
    )
  }, [defaultFromDate, defaultToDate, t])

  // Validate date range
  const isDateRangeValid = useMemo(() => {
    if (!defaultFromDate || !defaultToDate) return true
    return new Date(defaultFromDate) <= new Date(defaultToDate)
  }, [defaultFromDate, defaultToDate])

  const handleSaveAll = useCallback(() => {
    const modifiedRows = []
    dateGridRef.current?.api.forEachNode((node) => {
      if (node.data.modified) {
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

    // TODO: Make API call to save all modified rows
    console.log('Saving modified rows:', modifiedRows)
    // Example: batchUpdateFSERecords(modifiedRows)

    dateGridAlertRef.current?.showAlert(
      'success',
      t(
        'finalSupplyEquipment:changesSaved',
        `Successfully saved ${modifiedRows.length} changes`
      )
    )
  }, [t])

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
          editable: false,
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
