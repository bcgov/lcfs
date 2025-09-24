import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { ROUTES } from '@/routes/routes'
import {
  faCirclePlus,
  faCheck,
  faBan,
  faSquareCheck,
  faFilterCircleXmark
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Box, Grid, Stack } from '@mui/material'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Outlet,
  useLocation,
  useNavigate,
  useSearchParams
} from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { defaultSortModel, chargingEquipmentColDefs } from './_schema'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import Loading from '@/components/Loading'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { BCAlert2 } from '@/components/BCAlert'
import { BulkActionModals } from './components/BulkActionModals'
import { useChargingEquipment } from '@/hooks/useChargingEquipment'

const initialPaginationOptions = {
  page: 1,
  size: 25,
  sortOrders: defaultSortModel,
  filters: []
}

export const ChargingEquipment = () => {
  const { t } = useTranslation(['common', 'chargingEquipment'])
  const navigate = useNavigate()
  const location = useLocation()
  const gridRef = useRef()
  const alertRef = useRef(null)
  const isProgrammaticSelection = useRef(false)
  const { data: currentUser, hasAnyRole, hasRoles } = useCurrentUser()

  const [searchParams, setSearchParams] = useSearchParams()
  const highlightedId = searchParams.get('hid')

  // Alerts now use BCAlert2 via alertRef
  const [selectedRows, setSelectedRows] = useState([])
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showDecommissionModal, setShowDecommissionModal] = useState(false)
  const [selectMode, setSelectMode] = useState(null) // 'draft-updated' or 'validated'

  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )

  const {
    data: equipmentData,
    isLoading,
    isError,
    error,
    refetch
  } = useChargingEquipment(paginationOptions)

  const {
    submitEquipment,
    decommissionEquipment,
    isSubmitting,
    isDecommissioning
  } = useChargingEquipment()

  // Check if we're on a nested route (like /new or /:id/edit)
  const isOnNestedRoute = location.pathname !== `${ROUTES.REPORTS.LIST}/fse`

  useEffect(() => {
    if (location.state?.message) {
      alertRef.current?.triggerAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location, navigate])

  const getRowId = useCallback((params) => {
    return params.data.charging_equipment_id
  }, [])

  const defaultColDef = useMemo(
    () => ({
      floatingFilter: true,
      filter: 'agTextColumnFilter',
      filterParams: {
        filterOptions: ['contains'],
        suppressAndOrCondition: true
      },
      resizable: true,
      sortable: true
    }),
    []
  )

  const handleNewFSE = () => {
    navigate(`${ROUTES.REPORTS.LIST}/fse/add`)
  }

  const handleSelectAllDraftUpdated = () => {
    if (selectMode === 'draft-updated') {
      // Deselect all
      gridRef.current?.api?.deselectAll()
      setSelectMode(null)
    } else {
      // Select all Draft and Updated rows
      isProgrammaticSelection.current = true
      gridRef.current?.api?.forEachNode((node) => {
        if (node.data.status === 'Draft' || node.data.status === 'Updated') {
          node.setSelected(true)
        } else {
          node.setSelected(false)
        }
      })
      setSelectMode('draft-updated')
      // Let ag-Grid finish emitting selection events before re-enabling handler logic
      setTimeout(() => {
        isProgrammaticSelection.current = false
      }, 0)
    }
  }

  const handleSelectAllValidated = () => {
    if (selectMode === 'validated') {
      // Deselect all
      gridRef.current?.api?.deselectAll()
      setSelectMode(null)
    } else {
      // Select all Validated rows
      isProgrammaticSelection.current = true
      gridRef.current?.api?.forEachNode((node) => {
        if (node.data.status === 'Validated') {
          node.setSelected(true)
        } else {
          node.setSelected(false)
        }
      })
      setSelectMode('validated')
      setTimeout(() => {
        isProgrammaticSelection.current = false
      }, 0)
    }
  }

  const handleRowClick = (params) => {
    // Ignore clicks on the checkbox selection column
    const colId = params?.column?.getColId?.()
    if (colId === '__select__') return
    const { charging_equipment_id } = params.data
    navigate(`${ROUTES.REPORTS.LIST}/fse/${charging_equipment_id}/edit`)
  }

  const handleSelectionChanged = (event) => {
    const selectedNodes = event.api.getSelectedNodes()
    setSelectedRows(selectedNodes.map((node) => node.data))

    // Skip mode reconciliation while running programmatic select-all
    if (isProgrammaticSelection.current) return

    // Clear select mode if manual selection doesn't match the mode
    const selectedData = selectedNodes.map((node) => node.data)
    const allDraftUpdated = selectedData.every(
      (row) => row.status === 'Draft' || row.status === 'Updated'
    )
    const allValidated = selectedData.every((row) => row.status === 'Validated')

    if (!allDraftUpdated && selectMode === 'draft-updated') {
      setSelectMode(null)
    } else if (!allValidated && selectMode === 'validated') {
      setSelectMode(null)
    }
  }

  const handleBulkSubmit = async () => {
    const equipmentIds = selectedRows.map((row) => row.charging_equipment_id)
    try {
      const result = await submitEquipment(equipmentIds)
      alertRef.current?.triggerAlert({
        message: result.message,
        severity: 'success'
      })
      // Optimistically update grid statuses
      gridRef.current?.api?.forEachNode((node) => {
        if (
          equipmentIds.includes(node.data.charging_equipment_id) &&
          (node.data.status === 'Draft' || node.data.status === 'Updated')
        ) {
          node.updateData({ ...node.data, status: 'Submitted' })
        }
      })
      setShowSubmitModal(false)
      setSelectMode(null)
      refetch()
      gridRef.current?.api?.deselectAll()
    } catch (error) {
      alertRef.current?.triggerAlert({
        message: error.message || 'Failed to submit equipment',
        severity: 'error'
      })
    }
  }

  const handleBulkDecommission = async () => {
    const equipmentIds = selectedRows.map((row) => row.charging_equipment_id)
    try {
      const result = await decommissionEquipment(equipmentIds)
      alertRef.current?.triggerAlert({
        message: result.message,
        severity: 'success'
      })
      // Optimistically update grid statuses
      gridRef.current?.api?.forEachNode((node) => {
        if (
          equipmentIds.includes(node.data.charging_equipment_id) &&
          node.data.status === 'Validated'
        ) {
          node.updateData({ ...node.data, status: 'Decommissioned' })
        }
      })
      setShowDecommissionModal(false)
      setSelectMode(null)
      refetch()
      gridRef.current?.api?.deselectAll()
    } catch (error) {
      alertRef.current?.triggerAlert({
        message: error.message || 'Failed to decommission equipment',
        severity: 'error'
      })
    }
  }

  const handleClearFilters = () => {
    setPaginationOptions(initialPaginationOptions)
    gridRef.current?.api?.setFilterModel(null)
  }

  const canSubmit = selectedRows.some(
    (row) => row.status === 'Draft' || row.status === 'Updated'
  )

  const canDecommission = selectedRows.some((row) => row.status === 'Validated')

  if (isLoading) return <Loading />
  if (isError) {
    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <BCTypography variant="h5" gutterBottom>
            {t('chargingEquipment:manageFSE')}
          </BCTypography>
          <BCAlert severity="error">
            {t('chargingEquipment:errorLoadingEquipment')}
            <br />
            <small>
              Please check if the backend charging equipment service is running
              properly.
            </small>
          </BCAlert>
        </Grid>
      </Grid>
    )
  }

  return (
    <Grid container spacing={3}>
      {!isOnNestedRoute && (
        <Grid item xs={12}>
          <BCTypography variant="h5" gutterBottom>
            {t('chargingEquipment:manageFSE')}
          </BCTypography>
          <BCTypography variant="body2" color="text.secondary" paragraph>
            {t('chargingEquipment:manageFSEDescription')}
          </BCTypography>
        </Grid>
      )}

      {!isOnNestedRoute && (
        <Grid item xs={12}>
          <BCAlert2 dismissible={true} ref={alertRef} data-test="alert-box" />
        </Grid>
      )}

      {!isOnNestedRoute && (
        <Grid item xs={12}>
          <BCBox sx={{ width: '100%', minHeight: 600 }}>
            <Box display="flex" justifyContent="space-between" mb={2}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ flexWrap: 'wrap' }}
              >
                <BCButton
                  variant="contained"
                  color="primary"
                  size="medium"
                  startIcon={<FontAwesomeIcon icon={faCirclePlus} />}
                  onClick={handleNewFSE}
                >
                  {t('chargingEquipment:newFSE')}
                </BCButton>

                <BCButton
                  variant="contained"
                  color="primary"
                  size="medium"
                  startIcon={<FontAwesomeIcon icon={faSquareCheck} />}
                  onClick={handleSelectAllDraftUpdated}
                >
                  {t('chargingEquipment:selectAllDraftUpdated')}
                </BCButton>

                <BCButton
                  variant="contained"
                  color="primary"
                  size="medium"
                  startIcon={<FontAwesomeIcon icon={faSquareCheck} />}
                  onClick={handleSelectAllValidated}
                >
                  {t('chargingEquipment:selectAllValidated')}
                </BCButton>

                <BCButton
                  variant="outlined"
                  color="primary"
                  size="medium"
                  startIcon={<FontAwesomeIcon icon={faCheck} />}
                  onClick={() => setShowSubmitModal(true)}
                  disabled={selectedRows.length === 0 || !canSubmit}
                >
                  {t('chargingEquipment:submitSelected')}
                </BCButton>

                <BCButton
                  variant="outlined"
                  color="error"
                  size="medium"
                  startIcon={<FontAwesomeIcon icon={faBan} />}
                  onClick={() => setShowDecommissionModal(true)}
                  disabled={selectedRows.length === 0 || !canDecommission}
                >
                  {t('chargingEquipment:setToDecommissioned')}
                </BCButton>
              </Stack>

              <ClearFiltersButton onClick={handleClearFilters} />
            </Box>

            <Box sx={{ height: 500, width: '100%' }}>
              <BCGridViewer
                gridRef={gridRef}
                alertRef={alertRef}
                columnDefs={chargingEquipmentColDefs}
                defaultColDef={defaultColDef}
                getRowId={getRowId}
                overlayLoadingTemplate="Loading FSE data..."
                overlayNoRowsTemplate="No FSE found"
                gridKey="charging-equipment"
                paginationOptions={paginationOptions}
                onPaginationChange={(opts) => setPaginationOptions(opts)}
                queryData={{ data: equipmentData, isLoading, isError, error }}
                onRowClicked={handleRowClick}
                rowSelection="multiple"
                onSelectionChanged={handleSelectionChanged}
                suppressRowClickSelection={true}
                rowMultiSelectWithClick={false}
                highlightedRowId={highlightedId}
              />
            </Box>
          </BCBox>
        </Grid>
      )}

      {!isOnNestedRoute && (
        <BulkActionModals
          showSubmitModal={showSubmitModal}
          showDecommissionModal={showDecommissionModal}
          selectedCount={selectedRows.length}
          onSubmitConfirm={handleBulkSubmit}
          onDecommissionConfirm={handleBulkDecommission}
          onSubmitCancel={() => setShowSubmitModal(false)}
          onDecommissionCancel={() => setShowDecommissionModal(false)}
          isSubmitting={isSubmitting}
          isDecommissioning={isDecommissioning}
        />
      )}

      {/* Render nested routes (bulk add, single edit) */}
      <Outlet />
    </Grid>
  )
}
