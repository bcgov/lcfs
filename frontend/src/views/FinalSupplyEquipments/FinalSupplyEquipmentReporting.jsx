import BCBox from '@/components/BCBox'
import { BCGridEditorPaginated } from '@/components/BCDataGrid/BCGridEditorPaginated'
import BCTypography from '@/components/BCTypography'
import { Stack, TextField, Autocomplete, Alert, CircularProgress } from '@mui/material'
import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import BCButton from '@/components/BCButton'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faDownload,
  faUpload,
  faEyeSlash,
  faFilterCircleXmark
} from '@fortawesome/free-solid-svg-icons'
import { useSiteNames } from '@/hooks/useChargingSite'
import { getFSEReportingColDefs } from './_schema'
import {
  useGetFSEReportingList,
  useSaveFSEReporting,
  useUpdateFSEReportingActiveStatus,
  useSetFSEReportingDefaultDates,
  useImportFSEReportingUpdate,
  useGetFSEReportingUpdateJobStatus
} from '@/hooks/useFinalSupplyEquipment'
import { useComplianceReportWithCache } from '@/hooks/useComplianceReports'
import { handleScheduleSave } from '@/utils/schedules'
import { defaultInitialPagination } from '@/constants/schedules'
import ROUTES from '@/routes/routes'
import { useApiService } from '@/services/useApiService'
import { apiRoutes } from '@/constants/routes'
import ImportDialog from '@/components/ImportDialog'

const inactiveRowsFilter = {
  field: 'isActive',
  type: 'equals',
  filterType: 'text',
  filter: 'false'
}

export const FinalSupplyEquipmentReporting = () => {
  const { t } = useTranslation()
  const apiService = useApiService()
  const [errors, setErrors] = useState({})
  const [warnings, setWarnings] = useState({})
  const [isGridReady, setGridReady] = useState(false)
  const [selectedSiteOption, setSelectedSiteOption] = useState(null)
  const [hasSelectedRows, setHasSelectedRows] = useState(false)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [isBulkUpdateDialogOpen, setIsBulkUpdateDialogOpen] = useState(false)
  // Pagination state
  const [paginationOptions, setPaginationOptions] = useState({
    defaultInitialPagination
  })
  const fseGridRef = useRef(null)
  const fseGridAlertRef = useRef(null)
  const previousSelectionRef = useRef(new Set())
  const globalSelectionRef = useRef(new Set())
  const validationStatusCacheRef = useRef(new Map())
  const isSyncingSelectionRef = useRef(false)

  const navigate = useNavigate()
  const { complianceReportId, compliancePeriod } = useParams()

  const minDate = `${compliancePeriod}-01-01`
  const maxDate = `${compliancePeriod}-12-31`
  // Get report data from store
  const { data: reportData, isLoading: isReportLoading } =
    useComplianceReportWithCache(complianceReportId)
  const organizationId = reportData?.report?.organizationId
  const { data: siteNames = [], isLoading: siteLoading } = useSiteNames(
    organizationId
  )

  const { control, watch } = useForm({
    defaultValues: {
      defaultFromDate: minDate,
      defaultToDate: maxDate
    }
  })

  const defaultFromDate = watch('defaultFromDate')
  const defaultToDate = watch('defaultToDate')

  const showingOnlyUnselected = useMemo(
    () =>
      (paginationOptions?.filters || []).some(
        (filter) =>
          filter.field === 'isActive' && String(filter.filter) === 'false'
      ),
    [paginationOptions]
  )

  // Query hook for data fetching
  const queryData = useGetFSEReportingList(
    complianceReportId,
    paginationOptions,
    { enabled: !!organizationId },
    organizationId,
    'all' // 'all' to fetch all equipments data.
  )
  const { data, isLoading, isError, refetch } = queryData

  // Mutation hook for saving changes
  const { mutateAsync: saveRow } = useSaveFSEReporting(
    organizationId,
    complianceReportId
  )

  const { mutateAsync: updateActiveStatus } =
    useUpdateFSEReportingActiveStatus(complianceReportId, organizationId)

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

      if (
        (belongsToCurrentReport || belongsToCurrentGroup) &&
        item.isActive !== false
      ) {
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

      isSyncingSelectionRef.current = true
      try {
        fseGridRef.current.api.setNodesSelected({
          nodes: nodesToSelect,
          newValue: true
        })
      } finally {
        isSyncingSelectionRef.current = false
      }
      previousSelectionRef.current = currentPageSelection
    }
  }, [data, isGridReady, paginationOptions.page])

  const syncGridSelection = useCallback((targetSelection) => {
    if (!fseGridRef.current?.api) return

    isSyncingSelectionRef.current = true
    try {
      fseGridRef.current.api.forEachNode((node) => {
        const equipmentId = node.data?.chargingEquipmentId
        if (!equipmentId) return
        const shouldSelect = targetSelection.has(equipmentId)
        const currentlySelected =
          typeof node.isSelected === 'function'
            ? node.isSelected()
            : !!node.selected
        if (shouldSelect !== currentlySelected) {
          node.setSelected?.(shouldSelect)
        }
      })
    } finally {
      isSyncingSelectionRef.current = false
    }
  }, [])

  // Handle row selection changes
  const handleSelectionChanged = useCallback(
    async () => {
      if (isSyncingSelectionRef.current) return

      const gridApi = fseGridRef.current?.api
      const selectedNodes = gridApi?.getSelectedNodes() ?? []
      const currentSelection = new Set(
        selectedNodes
          .map((node) => node.data.chargingEquipmentId)
          .filter(Boolean)
      )

      const nodesToCreate = []
      const nodesToReactivate = []
      selectedNodes.forEach((node) => {
        const equipmentId = node.data?.chargingEquipmentId
        if (
          equipmentId &&
          !previousSelectionRef.current.has(equipmentId)
        ) {
          if (
            node.data?.chargingEquipmentComplianceId &&
            node.data?.isActive === false
          ) {
            nodesToReactivate.push(node)
          } else if (!node.data?.chargingEquipmentComplianceId) {
            nodesToCreate.push(node)
          }
        }
      })

      const newlyUnselectedIds = []
      const newlyUnselectedEquipmentIds = []
      const newlyUnselectedNodes = []
      gridApi?.forEachNode((node) => {
        const equipmentId = node.data?.chargingEquipmentId
        if (
          equipmentId &&
          previousSelectionRef.current.has(equipmentId) &&
          !currentSelection.has(equipmentId) &&
          node.data.chargingEquipmentComplianceId &&
          node.data.isActive !== false
        ) {
          newlyUnselectedIds.push(
            parseInt(node.data.chargingEquipmentComplianceId)
          )
          newlyUnselectedEquipmentIds.push(equipmentId)
          newlyUnselectedNodes.push(node)
        }
      })

      if (
        nodesToCreate.length === 0 &&
        nodesToReactivate.length === 0 &&
        newlyUnselectedIds.length === 0
      ) {
        return
      }

      const selectionResult = new Set(previousSelectionRef.current)

      const revertSelection = () => {
        syncGridSelection(selectionResult)
        globalSelectionRef.current = new Set(selectionResult)
        previousSelectionRef.current = new Set(selectionResult)
        setHasSelectedRows(selectionResult.size > 0)
      }

      let created = false
      let reactivated = false
      let deactivated = false

      if (nodesToReactivate.length > 0) {
        try {
          await updateActiveStatus({
            reportingIds: nodesToReactivate.map((node) =>
              parseInt(node.data.chargingEquipmentComplianceId)
            ),
            isActive: true
          })

          nodesToReactivate.forEach((node) => {
            const equipmentId = node.data?.chargingEquipmentId
            selectionResult.add(equipmentId)
            node.updateData({
              ...node.data,
              isActive: true
            })
          })
          reactivated = true
        } catch (error) {
          console.error('Error reactivating FSE reporting records:', error)
          fseGridAlertRef.current?.triggerAlert({
            message: t('finalSupplyEquipment:errorAddDeleteRows'),
            severity: 'error'
          })
          revertSelection()
          return
        }
      }

      if (nodesToCreate.length > 0) {
        try {
          const newRows = nodesToCreate.map((node) => ({
            supplyFromDate: defaultFromDate,
            supplyToDate: defaultToDate,
            kwhUsage: node.data.kwhUsage,
            complianceNotes: node.data.complianceNotes || null,
            chargingEquipmentId: node.data.chargingEquipmentId,
            chargingEquipmentVersion: node.data.chargingEquipmentVersion,
            organizationId,
            complianceReportId,
            complianceReportGroupUuid:
              reportData?.report?.complianceReportGroupUuid
          }))

          const response = await saveRow(newRows)

          nodesToCreate.forEach((node, index) => {
            const equipmentId = node.data?.chargingEquipmentId
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
              complianceReportGroupUuid:
                reportData?.report?.complianceReportGroupUuid,
              complianceNotes: node.data.complianceNotes || null,
              isActive: true
            })
            if (equipmentId) {
              selectionResult.add(equipmentId)
            }
          })
          created = true
        } catch (error) {
          console.error('Error creating FSE reporting records:', error)
          fseGridAlertRef.current?.triggerAlert({
            message: t('finalSupplyEquipment:errorAddDeleteRows'),
            severity: 'error'
          })
          revertSelection()
          return
        }
      }

      if (newlyUnselectedIds.length > 0) {
        try {
          await updateActiveStatus({
            reportingIds: newlyUnselectedIds,
            isActive: false
          })

          newlyUnselectedNodes.forEach((node) => {
            node.updateData({
              ...node.data,
              isActive: false
            })
          })
          newlyUnselectedEquipmentIds.forEach((id) => {
            validationStatusCacheRef.current.delete(id)
            selectionResult.delete(id)
          })
          deactivated = true
        } catch (error) {
          console.error('Error deactivating FSE reporting records:', error)
          fseGridAlertRef.current?.triggerAlert({
            message: t('finalSupplyEquipment:errorAddDeleteRows'),
            severity: 'error'
          })
          revertSelection()
          return
        }
      }

      globalSelectionRef.current = new Set(selectionResult)
      previousSelectionRef.current = new Set(selectionResult)
      setHasSelectedRows(selectionResult.size > 0)

      if (created) {
        fseGridAlertRef.current?.triggerAlert({
          message: t('finalSupplyEquipment:rowsCreatedSuccessfully'),
          severity: 'success'
        })
      } else if (reactivated) {
        fseGridAlertRef.current?.triggerAlert({
          message: t('finalSupplyEquipment:rowsReactivatedSuccessfully'),
          severity: 'success'
        })
      } else if (deactivated) {
        fseGridAlertRef.current?.triggerAlert({
          message: t('finalSupplyEquipment:rowsExcludedSuccessfully'),
          severity: 'success'
        })
      }
    },
    [
      saveRow,
      updateActiveStatus,
      complianceReportId,
      reportData,
      defaultFromDate,
      defaultToDate,
      t,
      syncGridSelection,
      organizationId
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
      onSelectionChanged: () => handleSelectionChanged(),
      getRowId: (params) =>
        params.data.chargingEquipmentId +
        '-' +
        params.data.chargingEquipmentVersion,
      stopEditingWhenCellsLoseFocus: true,
      getRowStyle: (params) =>
        params.data?.isActive === false
          ? { opacity: 0.6, backgroundColor: 'rgba(0,0,0,0.04)' }
          : undefined
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
  const handleCellValueChanged = useCallback(
    async (params) => {
      if (params.data?.isActive === false) return
      if (params.oldValue === params.newValue) return

      params.node.updateData({
        ...params.node.data,
        validationStatus: 'pending'
      })
      const equipmentId = params.node?.data?.chargingEquipmentId
      if (equipmentId) {
        validationStatusCacheRef.current.set(equipmentId, 'pending')
      }
      const updatedData = {
        supplyFromDate: params.data.supplyFromDate,
        supplyToDate: params.data.supplyToDate,
        kwhUsage: params.data.kwhUsage,
        complianceNotes: params.data.complianceNotes,
        chargingEquipmentComplianceId:
          params.data.chargingEquipmentComplianceId,
        chargingEquipmentId: params.data.chargingEquipmentId,
        chargingEquipmentVersion: params.data.chargingEquipmentVersion,
        complianceReportId: parseInt(complianceReportId),
        complianceReportGroupUuid:
          reportData?.report?.complianceReportGroupUuid,
        organizationId,
        isActive: params.data.isActive !== false
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

  const handleDownloadTemplate = useCallback(async () => {
    if (!complianceReportId) return
    try {
      setDownloadError('')
      setIsDownloadingTemplate(true)
      await apiService.download({
        url: apiRoutes.fseReportingUpdateTemplate.replace(
          ':reportID',
          complianceReportId
        )
      })
    } catch (error) {
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        t('finalSupplyEquipment:bulkUpdate.downloadError')
      setDownloadError(detail)
    } finally {
      setIsDownloadingTemplate(false)
    }
  }, [complianceReportId, apiService, t])

  const handleSiteChange = useCallback((event, newValue) => {
    setSelectedSiteOption(newValue)
    // Update filters in pagination options
    setPaginationOptions((prev) => ({
      ...prev,
      page: 1,
      filters: [
        ...(newValue
          ? [
              {
                field: 'chargingSiteId',
                type: 'equals',
                filterType: 'number',
                filter: newValue.chargingSiteId
              }
            ]
          : []),
        ...(showingOnlyUnselected ? [inactiveRowsFilter] : [])
      ]
    }))
  }, [showingOnlyUnselected])

  const handleToggleUnselectedRows = useCallback(() => {
    setPaginationOptions((prev) => {
      const filters = prev?.filters || []
      const nextFilters = showingOnlyUnselected
        ? filters.filter((filter) => filter.field !== 'isActive')
        : [
            ...filters.filter((filter) => filter.field !== 'isActive'),
            inactiveRowsFilter
          ]

      return {
        ...prev,
        page: 1,
        filters: nextFilters
      }
    })
  }, [showingOnlyUnselected])

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
      .filter(
        (node) =>
          node.data.chargingEquipmentComplianceId &&
          node.data.isActive !== false
      )
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
        complianceReportGroupUuid:
          reportData?.report?.complianceReportGroupUuid,
        organizationId
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

  // Check if we should show the instructional message
  const shouldShowInstructionalMessage = useMemo(() => {
    return (
      data?.hasChargingEquipment === false &&
      (data?.pagination?.total || 0) === 0
    )
  }, [data])

  if (isReportLoading || !organizationId) {
    return (
      <Stack
        data-test="fse-reporting-loading"
        alignItems="center"
        justifyContent="center"
        sx={{ width: '100%', minHeight: 200 }}
      >
        <CircularProgress />
      </Stack>
    )
  }

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

      {shouldShowInstructionalMessage && (
        <Alert severity="info">
          <BCTypography variant="body2">
            {t('finalSupplyEquipment:noChargingEquipmentMessage')}
          </BCTypography>
        </Alert>
      )}

      {!shouldShowInstructionalMessage && (
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
          <BCButton
            variant="outlined"
            size="medium"
            color="primary"
            startIcon={
              isDownloadingTemplate ? null : (
                <FontAwesomeIcon icon={faDownload} />
              )
            }
            onClick={handleDownloadTemplate}
            isLoading={isDownloadingTemplate}
            disabled={isDownloadingTemplate}
            sx={{ height: 40 }}
          >
            {t('finalSupplyEquipment:bulkUpdate.downloadTemplate')}
          </BCButton>

          <BCButton
            variant="outlined"
            size="medium"
            color="primary"
            startIcon={<FontAwesomeIcon icon={faUpload} />}
            onClick={() => setIsBulkUpdateDialogOpen(true)}
            sx={{ height: 40 }}
          >
            {t('finalSupplyEquipment:bulkUpdate.uploadTemplate')}
          </BCButton>
         <BCButton
            variant="outlined"
            size="medium"
            color={showingOnlyUnselected ? 'secondary' : 'primary'}
            startIcon={
              <FontAwesomeIcon
                icon={
                  showingOnlyUnselected ? faFilterCircleXmark : faEyeSlash
                }
              />
            }
            onClick={handleToggleUnselectedRows}
            sx={{ height: 40, whiteSpace: 'nowrap' }}
          >
            {showingOnlyUnselected
              ? t('common:showAll', 'Show all')
              : t('finalSupplyEquipment:showUnselectedRows', 'Show unselected rows only')}
          </BCButton>

        </BCBox>

        {/* Right side: Filter dropdown */}
        <BCBox
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            marginLeft: 'auto'
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
      )}

      {downloadError && (
        <Alert severity="error" onClose={() => setDownloadError('')}>
          {downloadError}
        </Alert>
      )}

      {!shouldShowInstructionalMessage && (
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
        getRowId={(params) => String(params.data.chargingEquipmentId + '-' + params.data.chargingEquipmentVersion)}
        onGridReady={handleGridReady}
        onCellValueChanged={handleCellValueChanged}
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
      )}

      <ImportDialog
        open={isBulkUpdateDialogOpen}
        close={() => setIsBulkUpdateDialogOpen(false)}
        complianceReportId={complianceReportId}
        isOverwrite={false}
        title={t('finalSupplyEquipment:bulkUpdate.dialogTitle')}
        importedLabel={t('finalSupplyEquipment:bulkUpdate.updatedCount')}
        skippedLabel={t('finalSupplyEquipment:bulkUpdate.skippedCount')}
        importHook={useImportFSEReportingUpdate}
        getJobStatusHook={useGetFSEReportingUpdateJobStatus}
        onComplete={() => {
          refetch()
        }}
      />
    </Stack>
  )
}

FinalSupplyEquipmentReporting.displayName = 'FinalSupplyEquipmentReporting'
