import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Grid2 as Grid } from '@mui/material'
import BCButton from '@/components/BCButton'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { chargingEquipmentColDefs } from './_schema'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import {
  useBulkUpdateEquipmentStatus,
  useChargingSiteEquipmentPaginated
} from '@/hooks/useChargingSite'
import { equipmentButtonConfigFn, buildButtonContext } from './buttonConfig'
import BCModal from '@/components/BCModal'
import { BCAlert2 } from '@/components/BCAlert'
import ROUTES from '@/routes/routes'
import colors from '@/themes/base/colors'

const initialPaginationOptions = {
  page: 1,
  size: 25,
  sortOrders: [],
  filters: []
}

const arrayOfStrings = (values = [], selector) =>
  [...values]
    .map((value) => (selector ? selector(value) : value))
    .filter(Boolean)
    .map(String)
    .sort()

const historyFieldConfig = {
  status: (row) => row?.status?.status ?? '',
  version: (row) => row?.version ?? '',
  complianceYears: (row) => arrayOfStrings(row?.complianceYears),
  serialNumber: (row) => row?.serialNumber ?? '',
  manufacturer: (row) => row?.manufacturer ?? '',
  model: (row) => row?.model ?? '',
  levelOfEquipment: (row) => row?.levelOfEquipment?.name ?? '',
  ports: (row) => row?.ports ?? '',
  intendedUseTypes: (row) =>
    arrayOfStrings(
      row?.intendedUseTypes || row?.intendedUses,
      (item) => item?.type || item
    ),
  intendedUserTypes: (row) =>
    arrayOfStrings(
      row?.intendedUserTypes || row?.intendedUsers,
      (item) => item?.typeName || item
    ),
  latitude: (row) => row?.latitude ?? '',
  longitude: (row) => row?.longitude ?? '',
  notes: (row) => row?.notes ?? ''
}

const areValuesEqual = (left, right) => {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left || []) === JSON.stringify(right || [])
  }
  return left === right
}

const buildHistoryRows = (equipments = [], expandedRows = new Set()) => {
  const groups = new Map()

  equipments.forEach((equipment) => {
    const registrationNumber =
      equipment.registrationNumber || `${equipment.chargingEquipmentId}`
    const group = groups.get(registrationNumber) || []
    group.push(equipment)
    groups.set(registrationNumber, group)
  })

  return [...groups.entries()].flatMap(([registrationNumber, versions]) => {
    const sortedVersions = [...versions].sort(
      (a, b) => (b.version || 0) - (a.version || 0)
    )
    const currentVersion = sortedVersions[0]
    const hasHistory = sortedVersions.length > 1
    const isExpanded = expandedRows.has(registrationNumber)

    const currentRow = {
      ...currentVersion,
      actionType: 'CURRENT',
      diff: [],
      hasHistory,
      isHistoryGroupStart: true,
      isHistoryGroupEnd: !hasHistory || !isExpanded,
      isCurrentVersionRow: true,
      isExpanded,
      rowKey: `${registrationNumber}-${currentVersion.version}-current`
    }

    if (!hasHistory || !isExpanded) {
      return [currentRow]
    }

    const historyRows = sortedVersions.slice(1).map((versionRow, index) => {
      const compareTo = sortedVersions[index]
      const diff = Object.entries(historyFieldConfig)
        .filter(([, getter]) =>
          !areValuesEqual(getter(versionRow), getter(compareTo))
        )
        .map(([field]) => field)

      return {
        ...versionRow,
        actionType: 'UPDATE',
        updated: false,
        diff,
        hasHistory: false,
        isHistoryGroupStart: false,
        isHistoryGroupEnd: index === sortedVersions.length - 2,
        isCurrentVersionRow: false,
        isHistoryVersion: true,
        parentRegistrationNumber: registrationNumber,
        rowKey: `${registrationNumber}-${versionRow.version}-history`
      }
    })

    return [currentRow, ...historyRows]
  })
}

export const ChargingSiteFSEGrid = ({
  hasAnyRole,
  hasRoles,
  historyMode = false,
  isIDIR,
  currentUser
}) => {
  const { t } = useTranslation(['chargingSite'])
  const navigate = useNavigate()
  const location = useLocation()
  const gridRef = useRef(null)
  const alertRef = useRef(null)
  const historyModeInitializedRef = useRef(false)

  const [modalData, setModalData] = useState(null)
  const [selectedRows, setSelectedRows] = useState([])
  const [expandedHistoryRows, setExpandedHistoryRows] = useState(new Set())
  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )

  const { siteId } = useParams()
  const equipmentQuery = useChargingSiteEquipmentPaginated(
    siteId,
    paginationOptions,
    { historyMode }
  )
  const { data: equipmentData, isLoading, refetch } = equipmentQuery

  const { mutateAsync: bulkUpdateStatus, isPending: isUpdating } =
    useBulkUpdateEquipmentStatus()

  const equipmentList = equipmentData?.equipments || []
  const visibleEquipmentRows = useMemo(() => {
    if (!historyMode) return equipmentList
    return buildHistoryRows(equipmentList, expandedHistoryRows)
  }, [equipmentList, expandedHistoryRows, historyMode])

  useEffect(() => {
    if (!historyMode) {
      historyModeInitializedRef.current = false
      setExpandedHistoryRows(new Set())
      return
    }

    if (historyModeInitializedRef.current || equipmentList.length === 0) {
      return
    }

    setExpandedHistoryRows(
      new Set(
        equipmentList.map(
          (equipment) =>
            equipment.registrationNumber || `${equipment.chargingEquipmentId}`
        )
      )
    )
    historyModeInitializedRef.current = true
  }, [historyMode, equipmentList])

  // Check if selected equipment can be submitted (only from Draft status)
  const canSubmit = useMemo(() => {
    if (historyMode || selectedRows.length === 0) return false
    const selectedEquipment = equipmentList.filter((eq) =>
      selectedRows.includes(eq.chargingEquipmentId)
    )
    return selectedEquipment.every(
      (eq) => eq.status.status === 'Draft' || eq.status.status === 'Updated'
    )
  }, [historyMode, selectedRows, equipmentList])

  // Check if selected equipment can be returned to draft (only from Submitted status)
  const canReturnToDraft = useMemo(() => {
    if (historyMode || selectedRows.length === 0) return false
    const selectedEquipment = equipmentList.filter((eq) =>
      selectedRows.includes(eq.chargingEquipmentId)
    )
    return selectedEquipment.every((eq) =>
      isIDIR
        ? eq.status.status === 'Submitted'
        : eq.status.status === 'Submitted' || eq.status.status === 'Validated'
    )
  }, [historyMode, selectedRows, equipmentList, isIDIR])

  // Check if selected equipment can be validated (only from Submitted status)
  const canValidate = useMemo(() => {
    if (historyMode || selectedRows.length === 0) return false
    const selectedEquipment = equipmentList.filter((eq) =>
      selectedRows.includes(eq.chargingEquipmentId)
    )
    return selectedEquipment.every((eq) => eq.status.status === 'Submitted')
  }, [historyMode, selectedRows, equipmentList])

  // Check if selected equipment can be decommissioned (only from Validated status)
  const canSetToDecommission = useMemo(() => {
    if (historyMode || selectedRows.length === 0) return false
    const selectedEquipment = equipmentList.filter((eq) =>
      selectedRows.includes(eq.chargingEquipmentId)
    )
    return selectedEquipment.every((eq) => eq.status.status === 'Validated')
  }, [historyMode, selectedRows, equipmentList])

  // Handle row selection for bulk operations
  const handleSelectionChanged = useCallback((api) => {
    const selectedNodes = api.getSelectedNodes()
    const selectedIds = selectedNodes.map(
      (node) => node.data.chargingEquipmentId
    )
    setSelectedRows(selectedIds)
  }, [])

  // Toggle select all equipment by status (accepts a single status string or array of statuses)
  const handleToggleSelectByStatus = useCallback(
    (status) => {
      const statuses = Array.isArray(status) ? status : [status]
      const equipmentWithStatus = equipmentList.filter((equipment) =>
        statuses.includes(equipment.status.status)
      )
      const equipmentIds = equipmentWithStatus.map(
        (equipment) => equipment.chargingEquipmentId
      )

      // Check if all equipment of this status is already selected
      const allSelected =
        equipmentIds.length > 0 &&
        equipmentIds.every((id) => selectedRows.includes(id))

      let newSelection
      if (allSelected) {
        // Unselect all equipment of this status
        newSelection = selectedRows.filter((id) => !equipmentIds.includes(id))
      } else {
        // Select all equipment of this status (merge with existing selection)
        newSelection = [...new Set([...selectedRows, ...equipmentIds])]
      }

      setSelectedRows(newSelection)

      // Update grid selection
      if (gridRef.current) {
        gridRef.current.api.forEachNode((node) => {
          const isSelected = newSelection.includes(
            node.data.chargingEquipmentId
          )
          node.setSelected(isSelected)
        })
      }
    },
    [equipmentList, selectedRows]
  )

  // Handle pagination changes
  const handlePaginationChange = useCallback((newPaginationOptions) => {
    setPaginationOptions(newPaginationOptions)
    setSelectedRows([])
    setExpandedHistoryRows(new Set())
  }, [])

  // Clear all selections and filters
  const handleClearFilters = useCallback(() => {
    setSelectedRows([])
    setExpandedHistoryRows(new Set())
    setPaginationOptions((prev) => ({
      ...prev,
      page: 1,
      size: 25,
      filters: [],
      sortOrders: []
    }))
    if (gridRef.current && gridRef.current.api) {
      gridRef.current.api.setFilterModel(null)
      gridRef.current.api.deselectAll()
    }
  }, [setPaginationOptions])

  const handleToggleHistory = useCallback((registrationNumber) => {
    setExpandedHistoryRows((prev) => {
      const next = new Set(prev)
      if (next.has(registrationNumber)) {
        next.delete(registrationNumber)
      } else {
        next.add(registrationNumber)
      }
      return next
    })
  }, [])

  // Navigate to create FSE page with siteId pre-selected
  const handleCreateFSE = useCallback(() => {
    navigate(`${ROUTES.REPORTS.LIST}/fse/add`, {
      state: {
        returnTo: location.pathname,
        chargingSiteId: parseInt(siteId)
      }
    })
  }, [navigate, location.pathname, siteId])

  // Bulk status update handlers
  const handleBulkStatusUpdate = useCallback(
    async (newStatus) => {
      if (historyMode) return
      if (selectedRows.length === 0) return

      try {
        await bulkUpdateStatus({
          siteId: parseInt(siteId),
          equipmentIds: selectedRows,
          newStatus
        })

        // If moving to Draft, check if all equipment on this site will now be Draft
        if (newStatus === 'Draft') {
          const allWillBeDraft = equipmentList.every(
            (eq) =>
              selectedRows.includes(eq.chargingEquipmentId) ||
              eq.status.status === 'Draft'
          )
          if (allWillBeDraft) {
            navigate(ROUTES.REPORTS.CHARGING_SITE.INDEX)
            return
          }
        }

        refetch()
        handleClearFilters()
        alertRef.current?.triggerAlert({
          message: t('equipmentBulkUpdateSuccess'),
          severity: 'success'
        })
      } catch (error) {
        console.error('Failed to update equipment status:', error)
        alertRef.current?.triggerAlert({
          message: error.response?.data?.detail || error.message,
          severity: 'error'
        })
      } finally {
        setModalData(null)
      }
    },
    [
      historyMode,
      selectedRows,
      siteId,
      bulkUpdateStatus,
      handleClearFilters,
      equipmentList,
      navigate
    ]
  )

  const gridOptions = useMemo(
    () => ({
      rowSelection: historyMode
        ? undefined
        : {
            checkboxes: true,
            mode: 'multiRow',
            headerCheckbox: true,
            isRowSelectable: (params) =>
              params.data?.status?.status !== 'Submitted' || isIDIR
          },
      selectionColumnDef: historyMode
        ? undefined
        : {
            suppressHeaderMenuButton: true,
            pinned: 'left'
          },
      suppressRowClickSelection: !historyMode,
      onSelectionChanged: historyMode
        ? undefined
        : (event) => handleSelectionChanged(event.api),
      getRowId: (params) => params.data?.rowKey || params.data.chargingEquipmentId
    }),
    [handleSelectionChanged, historyMode, isIDIR]
  )

  const handleCellClicked = useCallback(
    (params) => {
      // For IDIR users, prevent navigation - they don't need edit access
      if (isIDIR || historyMode) {
        return
      }

      const colId = params?.column?.getColId?.()
      if (colId === 'ag-Grid-ControlsColumn') return
      const { chargingEquipmentId } = params.data
      navigate(`${ROUTES.REPORTS.LIST}/fse/${chargingEquipmentId}/edit`, {
        state: {
          returnTo: location.pathname,
          chargingSiteId: siteId // Pass siteId to lock the Charging Site field
        }
      })
    },
    [navigate, siteId, isIDIR, historyMode, location.pathname]
  )

  // Build context for button configuration
  const buttonContext = useMemo(() => {
    return buildButtonContext({
      t,
      setModalData,
      equipmentList,
      selectedRows,
      isUpdating,
      canValidate,
      canReturnToDraft,
      canSubmit,
      canSetToDecommission,
      chargingSiteStatus: equipmentData?.status?.status || 'Draft',
      organizationId: equipmentData?.organizationId || null,
      currentUser,
      hasAnyRole,
      hasRoles,
      handleToggleSelectByStatus,
      handleBulkStatusUpdate,
      handleClearFilters,
      handleCreateFSE
    })
  }, [
    setModalData,
    equipmentList,
    selectedRows,
    isUpdating,
    canValidate,
    canReturnToDraft,
    canSubmit,
    canSetToDecommission,
    equipmentData?.chargingSiteStatus,
    equipmentData?.organizationId,
    currentUser?.userId,
    handleToggleSelectByStatus,
    handleBulkStatusUpdate,
    handleClearFilters,
    handleCreateFSE
  ])

  // Get configured buttons based on user role and context
  const availableButtons = useMemo(() => {
    if (historyMode) return []
    return equipmentButtonConfigFn(buttonContext)
  }, [buttonContext, historyMode])

  return (
    <>
      {/* Equipment Processing Section */}
      <Grid size={12} sx={{ mt: { xs: 2, md: 4 } }}>
        <BCBox sx={{ mb: 3 }}>
          <BCTypography variant="h6" color="primary">
            {historyMode
              ? t('historyGridTitle')
              : isIDIR
                ? t('equipmentProcessingTitle')
                : t('gridTitle')}
          </BCTypography>
          <BCTypography variant="body4" color="text" mt={1} component="div">
            {historyMode
              ? t('historyGridDescription')
              : isIDIR
                ? t('equipmentProcessingDescription')
                : t('gridDescription')}
          </BCTypography>
        </BCBox>
        <BCModal
          open={!!modalData}
          onClose={() => setModalData(null)}
          data={modalData}
        />
        {/* Dynamic Action Buttons Based on Role */}
        {availableButtons.length > 0 && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {availableButtons.map((button) => (
              <Grid
                size={{
                  xs: 12,
                  sm: 6,
                  md: 12 / availableButtons.length
                }}
                key={button.id}
              >
                <BCButton
                  variant={button.variant}
                  color={button.color}
                  type="button"
                  startIcon={button.startIcon}
                  onClick={button.handler}
                  disabled={button.disabled}
                  title={button.title}
                  fullWidth
                >
                  {button.label}
                </BCButton>
              </Grid>
            ))}
          </Grid>
        )}
        <BCAlert2 dismissible={true} ref={alertRef} data-test="alert-box" />

        {/* Data Grid */}
        <BCBox sx={{ width: '100%' }}>
          <BCGridViewer
            gridRef={gridRef}
            alertRef={alertRef}
            columnDefs={chargingEquipmentColDefs(t, isIDIR, {
              enableSelection: false,
              historyMode,
              onToggleHistory: handleToggleHistory,
              expandedRows: expandedHistoryRows,
              showIntendedUsers: true,
              showLocationFields: true,
              showPorts: true,
              showNotes: true
            })}
            queryData={
              historyMode
                ? {
                    ...equipmentQuery,
                    data: {
                      ...equipmentData,
                      equipments: visibleEquipmentRows,
                      pagination: {
                        ...(equipmentData?.pagination || {}),
                        total: visibleEquipmentRows.length
                      }
                    }
                  }
                : equipmentQuery
            }
            dataKey="equipments"
            getRowId={(params) =>
              String(params.data?.rowKey || params.data.chargingEquipmentId)
            }
            paginationOptions={paginationOptions}
            onPaginationChange={handlePaginationChange}
            onCellClicked={historyMode ? undefined : handleCellClicked}
            overlayNoRowsTemplate={t('chargingSite:noChargingEquipmentsFnd')}
            gridOptions={gridOptions}
            enableCopyButton={false}
            gridKey="charging-site-equipment"
            autoSizeStrategy={{
              type: 'fitCellContents',
              defaultMinWidth: 100,
              defaultMaxWidth: 600
            }}
            defaultColDef={{
              filter: false,
              sortable: true,
              resizable: true,
              minWidth: 100
            }}
            getRowStyle={(params) =>
              historyMode
                ? {
                    backgroundColor: params.data?.isHistoryVersion
                      ? params.data?.diff?.length > 0
                        ? colors.alerts.warning.background
                        : '#f6f8fb'
                      : undefined,
                    borderTop: params.data?.isHistoryGroupStart
                      ? `2px solid ${colors.grey[600]}`
                      : undefined,
                    borderBottom: params.data?.isHistoryGroupEnd
                      ? `2px solid ${colors.grey[600]}`
                      : undefined
                  }
                : undefined
            }
          />
        </BCBox>
      </Grid>
    </>
  )
}
