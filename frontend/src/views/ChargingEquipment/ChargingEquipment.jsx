import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { ROUTES } from '@/routes/routes'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Box, Grid } from '@mui/material'
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
import { BulkActionButtons } from './components/BulkActionButtons'
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
  const { data: currentUser, hasAnyRole, hasRoles } = useCurrentUser()

  const [searchParams, setSearchParams] = useSearchParams()
  const highlightedId = searchParams.get('hid')

  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
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
  const isOnNestedRoute =
    location.pathname !== `${ROUTES.REPORTS.LIST}/manage-fse`

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
    navigate(`${ROUTES.REPORTS.LIST}/manage-fse/new`)
  }

  const handleSelectAllDraftUpdated = () => {
    if (selectMode === 'draft-updated') {
      // Deselect all
      gridRef.current?.api?.deselectAll()
      setSelectMode(null)
    } else {
      // Select all Draft and Updated rows
      gridRef.current?.api?.forEachNode((node) => {
        if (node.data.status === 'Draft' || node.data.status === 'Updated') {
          node.setSelected(true)
        } else {
          node.setSelected(false)
        }
      })
      setSelectMode('draft-updated')
    }
  }

  const handleSelectAllValidated = () => {
    if (selectMode === 'validated') {
      // Deselect all
      gridRef.current?.api?.deselectAll()
      setSelectMode(null)
    } else {
      // Select all Validated rows
      gridRef.current?.api?.forEachNode((node) => {
        if (node.data.status === 'Validated') {
          node.setSelected(true)
        } else {
          node.setSelected(false)
        }
      })
      setSelectMode('validated')
    }
  }

  const handleRowClick = (params) => {
    const { status, charging_equipment_id } = params.data
    if (status === 'Draft' || status === 'Updated' || status === 'Validated') {
      navigate(
        `${ROUTES.REPORTS.LIST}/manage-fse/${charging_equipment_id}/edit`
      )
    } else {
      navigate(
        `${ROUTES.REPORTS.LIST}/manage-fse/${charging_equipment_id}/edit`
      )
    }
  }

  const handleSelectionChanged = (event) => {
    const selectedNodes = event.api.getSelectedNodes()
    setSelectedRows(selectedNodes.map((node) => node.data))

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
      setAlertMessage(result.message)
      setAlertSeverity('success')
      setShowSubmitModal(false)
      setSelectMode(null)
      refetch()
      gridRef.current?.api?.deselectAll()
    } catch (error) {
      setAlertMessage(error.message || 'Failed to submit equipment')
      setAlertSeverity('error')
    }
  }

  const handleBulkDecommission = async () => {
    const equipmentIds = selectedRows.map((row) => row.charging_equipment_id)
    try {
      const result = await decommissionEquipment(equipmentIds)
      setAlertMessage(result.message)
      setAlertSeverity('success')
      setShowDecommissionModal(false)
      setSelectMode(null)
      refetch()
      gridRef.current?.api?.deselectAll()
    } catch (error) {
      setAlertMessage(error.message || 'Failed to decommission equipment')
      setAlertSeverity('error')
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
          <BCTypography variant="body1" color="text.secondary" paragraph>
            {t('chargingEquipment:manageFSEDescription')}
          </BCTypography>
        </Grid>
      )}

      {!isOnNestedRoute && alertMessage && (
        <Grid item xs={12}>
          <BCAlert severity={alertSeverity} onClose={() => setAlertMessage('')}>
            {alertMessage}
          </BCAlert>
        </Grid>
      )}

      {!isOnNestedRoute && (
        <Grid item xs={12}>
          <BCBox>
            <Box display="flex" justifyContent="space-between" mb={2}>
              <Box display="flex" gap={2}>
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
                  variant="outlined"
                  color="primary"
                  size="medium"
                  onClick={handleSelectAllDraftUpdated}
                >
                  {t('chargingEquipment:selectAllDraftUpdated')}
                </BCButton>

                <BCButton
                  variant="outlined"
                  color="primary"
                  size="medium"
                  onClick={handleSelectAllValidated}
                >
                  {t('chargingEquipment:selectAllValidated')}
                </BCButton>

                <BulkActionButtons
                  selectedRows={selectedRows}
                  canSubmit={canSubmit}
                  canDecommission={canDecommission}
                  onSubmitClick={() => setShowSubmitModal(true)}
                  onDecommissionClick={() => setShowDecommissionModal(true)}
                />
              </Box>

              <ClearFiltersButton onClick={handleClearFilters} />
            </Box>

            <BCGridViewer
              gridRef={gridRef}
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
              checkboxSelection={true}
              rowMultiSelectWithClick={false}
              highlightedRowId={highlightedId}
            />
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
