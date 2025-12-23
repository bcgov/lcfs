import { useCallback, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Grid2 as Grid, Stack } from '@mui/material'
import BCButton from '@/components/BCButton'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { chargingEquipmentColDefs, defaultColDef } from './_schema'

import { defaultInitialPagination } from '@/constants/schedules'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import {
  useBulkUpdateEquipmentStatus,
  useChargingSiteEquipmentPaginated
} from '@/hooks/useChargingSite'
import { equipmentButtonConfigFn, buildButtonContext } from './buttonConfig'
import BCModal from '@/components/BCModal'
import { Role } from '@/components/Role'
import { govRoles, roles } from '@/constants/roles'
import { BCAlert2 } from '@/components/BCAlert'
import ROUTES from '@/routes/routes'

const initialPaginationOptions = {
  page: 1,
  size: 25,
  sortOrders: [],
  filters: []
}

export const ChargingSiteFSEGrid = ({
  hasAnyRole,
  hasRoles,
  isIDIR,
  currentUser
}) => {
  const { t } = useTranslation(['chargingSite'])
  const navigate = useNavigate()
  const location = useLocation()
  const gridRef = useRef(null)
  const alertRef = useRef(null)

  const [modalData, setModalData] = useState(null)
  const [selectedRows, setSelectedRows] = useState([])
  const [gridApi, setGridApi] = useState(null)
  const [isAllSelected, setIsAllSelected] = useState(false)
  const [selectedRowCount, setSelectedRowCount] = useState(0)
  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )

  const { siteId } = useParams()
  const equipmentQuery = useChargingSiteEquipmentPaginated(
    siteId,
    paginationOptions
  )
  const { data: equipmentData, isLoading, refetch } = equipmentQuery

  const { mutateAsync: bulkUpdateStatus, isPending: isUpdating } =
    useBulkUpdateEquipmentStatus()

  const equipmentList = equipmentData?.equipments || []

  // Check if selected equipment can be submitted (only from Draft status)
  const canSubmit = useMemo(() => {
    if (selectedRows.length === 0) return false
    const selectedEquipment = equipmentList.filter((eq) =>
      selectedRows.includes(eq.chargingEquipmentId)
    )
    return selectedEquipment.every((eq) => eq.status.status === 'Draft')
  }, [selectedRows, equipmentList])

  // Check if selected equipment can be returned to draft (only from Submitted status)
  const canReturnToDraft = useMemo(() => {
    if (selectedRows.length === 0) return false
    const selectedEquipment = equipmentList.filter((eq) =>
      selectedRows.includes(eq.chargingEquipmentId)
    )
    return selectedEquipment.every((eq) => eq.status.status === 'Submitted')
  }, [selectedRows, equipmentList])

  // Check if selected equipment can be returned to submitted (undo validation - only from Validated status)
  const canUndoValidation = useMemo(() => {
    if (selectedRows.length === 0) return false
    const selectedEquipment = equipmentList.filter((eq) =>
      selectedRows.includes(eq.chargingEquipmentId)
    )
    return selectedEquipment.every((eq) => eq.status.status === 'Validated')
  }, [selectedRows, equipmentList])

  // Check if selected equipment can be validated (only from Submitted status)
  const canValidate = useMemo(() => {
    if (selectedRows.length === 0) return false
    const selectedEquipment = equipmentList.filter((eq) =>
      selectedRows.includes(eq.chargingEquipmentId)
    )
    return selectedEquipment.every((eq) => eq.status.status === 'Submitted')
  }, [selectedRows, equipmentList])

  // Check if selected equipment can be decommissioned (only from Validated status)
  const canSetToDecommission = useMemo(() => {
    if (selectedRows.length === 0) return false
    const selectedEquipment = equipmentList.filter((eq) =>
      selectedRows.includes(eq.chargingEquipmentId)
    )
    return selectedEquipment.every((eq) => eq.status.status === 'Validated')
  }, [selectedRows, equipmentList])

  // Handle row selection for bulk operations
  const handleSelectionChanged = useCallback((api) => {
    const selectedNodes = api.getSelectedNodes()
    const selectedIds = selectedNodes.map(
      (node) => node.data.chargingEquipmentId
    )
    setSelectedRows(selectedIds)
  }, [])

  // Toggle select all equipment by status
  const handleToggleSelectByStatus = useCallback(
    (status) => {
      const equipmentWithStatus = equipmentList.filter(
        (equipment) => equipment.status.status === status
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
  }, [])

  // Clear all selections and filters
  const handleClearFilters = useCallback(() => {
    setSelectedRows([])
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

  // Navigate to create FSE page with siteId pre-selected
  const handleCreateFSE = useCallback(() => {
    navigate(`${ROUTES.REPORTS.LIST}/fse/add`, {
      state: {
        returnTo: location.pathname,
        chargingSiteId: parseInt(siteId)
      }
    })
  }, [navigate, location.pathname, siteId])

  // Export selected equipment
  const handleExportSelected = useCallback(() => {
    console.log('Exporting selected equipment:', selectedRows)
  }, [selectedRows])

  // Bulk status update handlers
  const handleBulkStatusUpdate = useCallback(
    async (newStatus) => {
      if (selectedRows.length === 0) return

      try {
        await bulkUpdateStatus({
          siteId: parseInt(siteId),
          equipmentIds: selectedRows,
          newStatus
        })
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
    [selectedRows, siteId, bulkUpdateStatus, handleClearFilters]
  )

  const gridOptions = useMemo(
    () => ({
      rowSelection: {
        checkboxes: true,
        mode: 'multiRow',
        headerCheckbox: true,
        isRowSelectable: (params) =>
          params.data?.status?.status !== 'Submitted' || isIDIR
      },
      selectionColumnDef: {
        suppressHeaderMenuButton: true,
        pinned: 'left'
      },
      suppressRowClickSelection: true,
      onSelectionChanged: (event) => handleSelectionChanged(event.api),
      getRowId: (params) => params.data.chargingEquipmentId
    }),
    [handleSelectionChanged]
  )

  const handleCellClicked = useCallback(
    (params) => {
      // For IDIR users, prevent navigation - they don't need edit access
      if (isIDIR) {
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
    [navigate, siteId, isIDIR, location.pathname]
  )

  const handleNewFSE = useCallback(() => {
    navigate(`${ROUTES.REPORTS.LIST}/fse/add`, {
      state: {
        returnTo: location.pathname,
        chargingSiteId: siteId
      }
    })
  }, [navigate, location.pathname, siteId])

  // Build context for button configuration
  const buttonContext = useMemo(() => {
    return buildButtonContext({
      t,
      setModalData,
      equipmentList,
      selectedRows,
      isUpdating,
      canValidate,
      canUndoValidation,
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
    canUndoValidation,
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
  const availableButtons = useMemo(
    () => equipmentButtonConfigFn(buttonContext),
    [buttonContext]
  )

  return (
    <>
      {/* Equipment Processing Section */}
      <Grid size={12} sx={{ mt: { xs: 2, md: 4 } }}>
        <BCBox sx={{ mb: 3 }}>
          <BCTypography variant="h6" color="primary">
            {isIDIR ? t('equipmentProcessingTitle') : t('gridTitle')}
          </BCTypography>
          <BCTypography variant="body4" color="text" mt={1} component="div">
            {isIDIR
              ? t('equipmentProcessingDescription')
              : t('gridDescription')}
          </BCTypography>
        </BCBox>
        <BCModal
          open={!!modalData}
          onClose={() => setModalData(null)}
          data={modalData}
        />
        {/* New FSE Button - Only for BCeID users */}
        {!isIDIR && (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <BCButton
                variant="contained"
                color="primary"
                type="button"
                onClick={handleNewFSE}
                fullWidth
              >
                {t('chargingSite:buttons.newFSE')}
              </BCButton>
            </Grid>
          </Grid>
        )}
        {/* Dynamic Action Buttons Based on Role */}
        {availableButtons.length > 0 && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {availableButtons.map((button) => (
              <Grid
                item
                xs={12}
                sm={6}
                md={12 / availableButtons.length}
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
              showIntendedUsers: true,
              showLocationFields: true,
              showNotes: true
            })}
            queryData={equipmentQuery}
            dataKey="equipments"
            getRowId={(params) => String(params.data.chargingEquipmentId)}
            paginationOptions={paginationOptions}
            onPaginationChange={handlePaginationChange}
            onCellClicked={handleCellClicked}
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
              minWidth: 100,
              width: 140,
              flex: 0
            }}
          />
        </BCBox>
      </Grid>
    </>
  )
}
