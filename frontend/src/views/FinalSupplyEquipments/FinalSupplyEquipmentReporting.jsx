import BCBox from '@/components/BCBox'
import { BCGridEditorPaginated } from '@/components/BCDataGrid/BCGridEditorPaginated'
import BCTypography from '@/components/BCTypography'
import { Stack, TextField, Autocomplete } from '@mui/material'
import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import BCButton from '@/components/BCButton'
import { useSiteNames } from '@/hooks/useChargingSite'
import { getFSEReportingColDefs } from './_schema'
import {
  useGetFSEReportingList,
  useSaveFSEReporting,
  useDeleteFSEReportingBatch,
  useSetFSEReportingDefaultDates
} from '@/hooks/useFinalSupplyEquipment'
import useComplianceReportStore from '@/stores/useComplianceReportStore'
import { handleScheduleSave } from '@/utils/schedules'
import { defaultInitialPagination } from '@/constants/schedules'
import ROUTES from '@/routes/routes'

export const FinalSupplyEquipmentReporting = () => {
  const { t } = useTranslation()
  const [errors, setErrors] = useState({})
  const [warnings, setWarnings] = useState({})
  const [isGridReady, setGridReady] = useState(false)
  const [selectedSiteOption, setSelectedSiteOption] = useState(null)
  const [hasSelectedRows, setHasSelectedRows] = useState(false)
  // Pagination state
  const [paginationOptions, setPaginationOptions] = useState({
    defaultInitialPagination
  })
  const fseGridRef = useRef(null)
  const fseGridAlertRef = useRef(null)
  const previousSelectionRef = useRef(new Set())
  const globalSelectionRef = useRef(new Set())
  const validationStatusCacheRef = useRef(new Map())

  const navigate = useNavigate()
  const { complianceReportId, compliancePeriod } = useParams()

  const minDate = `${compliancePeriod}-01-01`
  const maxDate = `${compliancePeriod}-12-31`
  // Get report data from store
  const reportData = useComplianceReportStore((state) =>
    state.getCachedReport(complianceReportId)
  )
  const { data: siteNames = [], isLoading: siteLoading } = useSiteNames(
    reportData?.report?.organizationId
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
    complianceReportId,
    paginationOptions,
    {},
    reportData?.report?.organizationId,
    'all' // 'all' to fetch all equipments data.
  )
  const { data, isLoading, isError, refetch } = queryData

  // Mutation hook for saving changes
  const { mutateAsync: saveRow } = useSaveFSEReporting(
    reportData?.report?.organizationId,
    complianceReportId
  )

  // Mutation hook for batch delete
  const { mutateAsync: deleteBatch } = useDeleteFSEReportingBatch(
    complianceReportId,
    reportData?.report?.organizationId
  )

  // Mutation hook for set defaults
  const { mutateAsync: setDefaults } =
    useSetFSEReportingDefaultDates(complianceReportId)

  // Initialize global selection from all data when component loads
  useEffect(() => {
    if (!data?.finalSupplyEquipments) return

    const globalSelection = new Set()
    const currentReportId = parseInt(complianceReportId)
    const currentGroupUuid = reportData?.report?.complianceReportGroupUuid

    data.finalSupplyEquipments.forEach((item) => {
      const belongsToCurrentReport = item.complianceReportId === currentReportId
      const belongsToCurrentGroup =
        item.complianceReportGroupUuid &&
        (!currentGroupUuid ||
          item.complianceReportGroupUuid === currentGroupUuid)

      if (belongsToCurrentReport || belongsToCurrentGroup) {
        globalSelection.add(item.chargingEquipmentId)
      }
    })

    globalSelectionRef.current = globalSelection
    setHasSelectedRows(globalSelection.size > 0)
  }, [data, complianceReportId, reportData?.report?.complianceReportGroupUuid])

  // Set selected site option from cached pagination filters
  useEffect(() => {
    if (siteNames.length > 0 && paginationOptions.filters?.length > 0) {
      const chargingSiteFilter = paginationOptions.filters.find(
        (filter) => filter.field === 'chargingSiteId'
      )
      if (chargingSiteFilter && !selectedSiteOption) {
        const cachedSite = siteNames.find(
          (site) => site.chargingSiteId === chargingSiteFilter.filter
        )
        if (cachedSite) {
          setSelectedSiteOption(cachedSite)
        }
      }
    }
  }, [siteNames, paginationOptions.filters, selectedSiteOption])

  // Update grid selection when page data changes
  useEffect(() => {
    if (isGridReady && fseGridRef.current?.api && data) {
      const currentPageSelection = new Set()
      const nodesToSelect = []

      fseGridRef.current.api.forEachNode((node) => {
        const equipmentId = node.data?.chargingEquipmentId
        if (!equipmentId) return

        if (node.data.validationStatus !== undefined) {
          validationStatusCacheRef.current.set(
            equipmentId,
            node.data.validationStatus
          )
        } else if (validationStatusCacheRef.current.has(equipmentId)) {
          const cachedStatus = validationStatusCacheRef.current.get(equipmentId)
          if (node.data.validationStatus !== cachedStatus) {
            node.updateData({
              ...node.data,
              validationStatus: cachedStatus
            })
          }
        }

        if (globalSelectionRef.current.has(equipmentId)) {
          nodesToSelect.push(node)
          currentPageSelection.add(equipmentId)
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
      const selectedNodes = fseGridRef.current?.api.getSelectedNodes()
      const currentSelection = new Set(
        selectedNodes.map((node) => node.data.chargingEquipmentId)
      )

      // Find newly selected rows (not previously selected)
      const newlySelected = selectedNodes.filter(
        (node) =>
          !previousSelectionRef.current.has(node.data.chargingEquipmentId) &&
          !node.data.chargingEquipmentComplianceId
      )

      // Find newly unselected rows (previously selected but now unselected)
      const newlyUnselected = []
      const newlyUnselectedEquipmentIds = []
      fseGridRef.current?.api.forEachNode((node) => {
        if (
          previousSelectionRef.current.has(node.data.chargingEquipmentId) &&
          !currentSelection.has(node.data.chargingEquipmentId) &&
          node.data.chargingEquipmentComplianceId
        ) {
          newlyUnselected.push(parseInt(node.data.chargingEquipmentComplianceId))
          newlyUnselectedEquipmentIds.push(node.data.chargingEquipmentId)
        }
      })

      try {
        // Handle newly selected rows
        if (newlySelected.length > 0) {
          const newRows = newlySelected.map((node) => ({
            supplyFromDate: defaultFromDate,
            supplyToDate: defaultToDate,
            kwhUsage: node.data.kwhUsage,
            complianceNotes: null,
            chargingEquipmentId: node.data.chargingEquipmentId,
            organizationId: reportData?.report?.organizationId,
            complianceReportId,
            complianceReportGroupUuid: reportData?.report?.complianceReportGroupUuid
          }))

          const response = await saveRow(newRows)

          // Update grid rows with created FSE reporting data
          newlySelected.forEach((node, index) => {
            const createdData = Array.isArray(response.data)
              ? response.data[index]
              : response.data
            node.updateData({
              ...node.data,
              chargingEquipmentComplianceId:
                createdData?.chargingEquipmentComplianceId || createdData?.id,
              supplyFromDate: defaultFromDate,
              supplyToDate: defaultToDate,
              complianceReportId: parseInt(complianceReportId),
              complianceReportGroupUuid: reportData?.report?.complianceReportGroupUuid,
              complianceNotes: null
            })
          })
        }

        // Handle newly unselected rows
        if (newlyUnselected.length > 0) {
          await deleteBatch(newlyUnselected)
          newlyUnselectedEquipmentIds.forEach((id) => {
            validationStatusCacheRef.current.delete(id)
          })
          // Update grid rows with deleted FSE reporting data
          newlySelected.forEach((node, index) => {
            node.updateData({
              ...node.data,
              supplyFromDate: defaultFromDate,
              supplyToDate: defaultToDate,
              kwhUsage: node.data.kwhUsage,
              complianceNotes: null,
              chargingEquipmentId: node.data.chargingEquipmentId,
              organizationId: reportData?.report?.organizationId,
              complianceReportId: null
            })
          })
        }

        if (newlySelected.length > 0) {
          fseGridAlertRef.current?.triggerAlert({
            message: t('finalSupplyEquipment:rowsCreatedSuccessfully'),
            severity: 'success'
          })
        } else if (newlyUnselected.length > 0) {
          fseGridAlertRef.current?.triggerAlert({
            message: t('finalSupplyEquipment:rowsDeletedSuccessfully'),
            severity: 'success'
          })
        }
      } catch (error) {
        console.error('Error updating FSE reporting records:', error)
        fseGridAlertRef.current?.triggerAlert({
          message: t('finalSupplyEquipment:errorAddDeleteRows'),
          severity: 'error'
        })
      }

      // Update global and previous selection tracking
      globalSelectionRef.current = currentSelection
      previousSelectionRef.current = currentSelection
      setHasSelectedRows(currentSelection.size > 0)
    },
    [
      saveRow,
      deleteBatch,
      complianceReportId,
      reportData,
      defaultFromDate,
      defaultToDate,
      refetch
    ]
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
        parseInt(complianceReportId),
        reportData?.report?.complianceReportGroupUuid
      ),
    [minDate, maxDate, errors, warnings, handleSelectionChanged]
  )

  const handleGridReady = useCallback(() => {
    setGridReady(true)
  }, [])

  // Handle individual cell edits with validation and saving
  const handleCellEditingStopped = useCallback(
    async (params) => {
      if (params.oldValue === params.newValue) return

      // Update validation status to pending
      params.node.updateData({
        ...params.node.data,
        validationStatus: 'pending'
      })
      const equipmentId = params.node?.data?.chargingEquipmentId
      if (equipmentId) {
        validationStatusCacheRef.current.set(equipmentId, 'pending')
      }
      // Prepare data for save
      const updatedData = {
        supplyFromDate: params.data.supplyFromDate,
        supplyToDate: params.data.supplyToDate,
        kwhUsage: params.data.kwhUsage,
        complianceNotes: params.data.complianceNotes,
        chargingEquipmentComplianceId: params.data.chargingEquipmentComplianceId,
        chargingEquipmentId: params.data.chargingEquipmentId,
        complianceReportId: parseInt(complianceReportId),
        complianceReportGroupUuid: reportData?.report?.complianceReportGroupUuid,
        organizationId: reportData?.report?.organizationId
      }

      const responseData = await handleScheduleSave({
        alertRef: fseGridAlertRef,
        idField: 'chargingEquipmentComplianceId',
        labelPrefix: 'finalSupplyEquipment',
        params,
        setErrors,
        setWarnings,
        saveRow,
        t,
        updatedData
      })
      console.log(responseData)
      params.node.updateData({
        ...params.node.data,
        validationStatus: responseData.validationStatus,
        modified: responseData.modified
      })
      if (equipmentId) {
        validationStatusCacheRef.current.set(
          equipmentId,
          responseData.validationStatus
        )
      }
      params.api?.autoSizeAllColumns?.()
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
        ? [
            {
              field: 'chargingSiteId',
              type: 'equals',
              filterType: 'number',
              filter: newValue.chargingSiteId
            }
          ]
        : []
    }))
  }, [])

  const handleSetDefaultValues = useCallback(async () => {
    const selectedNodes = fseGridRef.current?.api.getSelectedNodes()
    if (!selectedNodes || selectedNodes.length === 0) {
      fseGridAlertRef.current?.showAlert(
        'warning',
        t('finalSupplyEquipment:noRowsSelected')
      )
      return
    }

    const equipmentIds = selectedNodes
      .filter((node) => node.data.chargingEquipmentComplianceId)
      .map((node) => node.data.chargingEquipmentId)

    if (equipmentIds.length === 0) {
      fseGridAlertRef.current?.showAlert(
        'warning',
        t('finalSupplyEquipment:noRowsSelected')
      )
      return
    }

    try {
      await setDefaults({
        supplyFromDate: defaultFromDate,
        supplyToDate: defaultToDate,
        equipmentIds,
        complianceReportId: parseInt(complianceReportId),
        complianceReportGroupUuid: reportData?.report?.complianceReportGroupUuid,
        organizationId: reportData?.report?.organizationId
      })
      fseGridAlertRef.current?.triggerAlert({
        message: t('finalSupplyEquipment:defaultValuesSet'),
        severity: 'success'
      })
    } catch (error) {
      console.error('Error setting default values:', error)
      fseGridAlertRef.current?.triggerAlert({
        message: t('finalSupplyEquipment:errorSettingDefaults'),
        severity: 'error'
      })
    }
  }, [
    defaultFromDate,
    defaultToDate,
    setDefaults,
    complianceReportId,
    reportData,
    t
  ])

  // Validate date range
  const isDateRangeValid = useMemo(() => {
    if (!defaultFromDate || !defaultToDate) return true
    return new Date(defaultFromDate) <= new Date(defaultToDate)
  }, [defaultFromDate, defaultToDate])

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
            disabled={!isDateRangeValid || !hasSelectedRows}
            sx={{ minWidth: 160, height: 40 }}
          >
            <BCTypography variant="body2">
              {t('finalSupplyEquipment:setDefaultValues')}
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
          onSave: (e) => {
            navigate(
              `/compliance-reporting/${compliancePeriod}/${complianceReportId}`
            )
          }
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
