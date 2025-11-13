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
import { Box, Grid, Stack, Autocomplete, TextField } from '@mui/material'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Outlet,
  useLocation,
  useNavigate,
  useSearchParams
} from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { chargingEquipmentColDefs } from '@/views/ChargingSite/components/_schema'

const defaultSortModel = [{ field: 'updateDate', direction: 'desc' }]

const defaultColDef = {
  editable: false,
  resizable: true,
  filter: 'agTextColumnFilter',
  floatingFilter: false,
  sortable: true,
  minWidth: 100
}
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { govRoles } from '@/constants/roles'
import { useOrganizationNames } from '@/hooks/useOrganizations'
import { Role } from '@/components/Role'
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

const EXCLUDED_ORG_TYPES = new Set([
  'non_bceid_supplier',
  'exempted_supplier',
  'fuel_producer',
  'initiative_agreement_holder'
])

export const ChargingEquipment = () => {
  const { t } = useTranslation(['common', 'chargingEquipment', 'chargingSite'])
  const navigate = useNavigate()
  const location = useLocation()
  const gridRef = useRef()
  const alertRef = useRef(null)
  const isProgrammaticSelection = useRef(false)
  const { data: currentUser, hasAnyRole, hasRoles } = useCurrentUser()
  const isIDIR = hasAnyRole(...govRoles)

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

  // Organization filter state (for IDIR users)
  const [selectedOrg, setSelectedOrg] = useState(() => {
    const savedOrgFilter = sessionStorage.getItem('fse-index-orgFilter')
    if (savedOrgFilter) {
      try {
        return JSON.parse(savedOrgFilter)
      } catch (error) {
        console.warn('Failed to parse saved organization filter:', error)
      }
    }
    return { id: null, label: null }
  })

  // Get organization names for IDIR users
  const { data: orgNames = [], isLoading: orgLoading } = useOrganizationNames(
    null,
    { orgFilter: 'all' },
    { enabled: isIDIR }
  )

  const filteredOrgNames = useMemo(
    () =>
      (orgNames || []).filter((org) => {
        const orgTypeKey = (org?.orgType || org?.org_type || '').toLowerCase()
        return !EXCLUDED_ORG_TYPES.has(orgTypeKey)
      }),
    [orgNames]
  )

  useEffect(() => {
    if (!selectedOrg.id) return
    const stillAvailable = filteredOrgNames.some(
      (org) => org.organizationId === selectedOrg.id
    )
    if (!stillAvailable) {
      setSelectedOrg({ id: null, label: null })
      sessionStorage.removeItem('fse-index-orgFilter')
    }
  }, [filteredOrgNames, selectedOrg.id])

  const renderOrganizationOption = (props, option) => {
    const orgTypeLabel = option?.orgType || option?.org_type
    const formattedOrgType = orgTypeLabel
      ? orgTypeLabel
          .split('_')
          .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
          .join(' ')
      : null

    return (
      <li {...props}>
        <Box display="flex" flexDirection="column">
          <BCTypography variant="body2">{option?.name || ''}</BCTypography>
          {/* {formattedOrgType && (
            <BCTypography variant="caption" color="text.secondary">
              {formattedOrgType}
            </BCTypography>
          )} */}
        </Box>
      </li>
    )
  }

  // Enhanced organization change handler with caching
  const handleOrganizationChange = useCallback((event, option) => {
    const id = option?.organizationId || null
    const label = option?.name || null
    const newSelectedOrg = { id, label }

    // Update state
    setSelectedOrg(newSelectedOrg)

    // Persist to session storage
    try {
      if (id && label) {
        sessionStorage.setItem(
          'fse-index-orgFilter',
          JSON.stringify(newSelectedOrg)
        )
      } else {
        sessionStorage.removeItem('fse-index-orgFilter')
      }
    } catch (error) {
      console.warn('Failed to update organization filter:', error)
    }
  }, [])

  // Find the selected organization object for the Autocomplete value
  const selectedOrgOption = useMemo(() => {
    if (!selectedOrg.id || !filteredOrgNames.length) return null
    return (
      filteredOrgNames.find((org) => org.organizationId === selectedOrg.id) ||
      null
    )
  }, [selectedOrg.id, filteredOrgNames])

  // Include organization filter in pagination options for IDIR users
  const enhancedPaginationOptions = useMemo(() => {
    const options = { ...paginationOptions }
    if (isIDIR && selectedOrg.id) {
      // Add organization filter to the API request
      options.organizationId = selectedOrg.id
    }
    return options
  }, [paginationOptions, isIDIR, selectedOrg.id])

  const equipmentQuery = useChargingEquipment(enhancedPaginationOptions)
  const {
    data: equipmentData,
    isLoading,
    isError,
    error,
    refetch
  } = equipmentQuery

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
    return params.data.chargingEquipmentId
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
    // Ensure grid API is available
    if (!gridRef.current?.api) {
      return
    }

    if (selectMode === 'draft-updated') {
      // Deselect all
      isProgrammaticSelection.current = true
      gridRef.current.api.deselectAll()
      setSelectMode(null)
      setTimeout(() => {
        isProgrammaticSelection.current = false
      }, 150)
    } else {
      // Select all Draft and Updated rows
      isProgrammaticSelection.current = true
      // Clear any existing selections first
      gridRef.current.api.deselectAll()
      // Set mode state before starting selections
      setSelectMode('draft-updated')
      // Use a small delay to ensure deselectAll completes
      setTimeout(() => {
        gridRef.current.api.forEachNode((node) => {
          if (node.data.status === 'Draft' || node.data.status === 'Updated') {
            node.setSelected(true)
          }
        })
        // Let ag-Grid finish emitting selection events before re-enabling handler logic
        setTimeout(() => {
          isProgrammaticSelection.current = false
        }, 150)
      }, 50)
    }
  }

  const handleSelectAllValidated = () => {
    // Ensure grid API is available
    if (!gridRef.current?.api) {
      return
    }

    if (selectMode === 'validated') {
      // Deselect all
      isProgrammaticSelection.current = true
      gridRef.current.api.deselectAll()
      setSelectMode(null)
      setTimeout(() => {
        isProgrammaticSelection.current = false
      }, 150)
    } else {
      // Select all Validated rows
      isProgrammaticSelection.current = true
      // Clear any existing selections first
      gridRef.current.api.deselectAll()
      // Set mode state before starting selections
      setSelectMode('validated')
      // Use a small delay to ensure deselectAll completes
      setTimeout(() => {
        gridRef.current.api.forEachNode((node) => {
          if (node.data.status === 'Validated') {
            node.setSelected(true)
          }
        })
        // Let ag-Grid finish emitting selection events before re-enabling handler logic
        setTimeout(() => {
          isProgrammaticSelection.current = false
        }, 150)
      }, 50)
    }
  }

  const handleRowClick = (params) => {
    // Ignore clicks on the checkbox selection column
    const colId = params?.column?.getColId?.()
    if (colId === '__select__') return

    // Check if user is IDIR/government
    const isIDIR = hasAnyRole(...govRoles)

    const { chargingEquipmentId, chargingSiteId } = params.data

    if (isIDIR) {
      // For IDIR users, navigate to the charging site page for this FSE
      navigate(
        ROUTES.REPORTS.CHARGING_SITE.VIEW.replace(':siteId', chargingSiteId)
      )
      return
    }

    // For supplier users, navigate to edit route
    navigate(ROUTES.REPORTS.EDIT_FSE.replace(':fseId', chargingEquipmentId))
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
    // Only submit equipment with Draft or Updated status
    const equipmentIds = selectedRows
      .filter((row) => row.status === 'Draft' || row.status === 'Updated')
      .map((row) => row.chargingEquipmentId)

    if (equipmentIds.length === 0) {
      alertRef.current?.triggerAlert({
        message: 'No Draft or Updated equipment selected to submit',
        severity: 'warning'
      })
      return
    }

    try {
      const result = await submitEquipment(equipmentIds)
      alertRef.current?.triggerAlert({
        message: result.message,
        severity: 'success'
      })
      // Optimistically update grid statuses
      gridRef.current?.api?.forEachNode((node) => {
        if (
          equipmentIds.includes(node.data.chargingEquipmentId) &&
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
    // Only decommission equipment with Validated status
    const equipmentIds = selectedRows
      .filter((row) => row.status === 'Validated')
      .map((row) => row.chargingEquipmentId)

    if (equipmentIds.length === 0) {
      alertRef.current?.triggerAlert({
        message: 'No Validated equipment selected to decommission',
        severity: 'warning'
      })
      return
    }

    try {
      const result = await decommissionEquipment(equipmentIds)
      alertRef.current?.triggerAlert({
        message: result.message,
        severity: 'success'
      })
      // Optimistically update grid statuses
      gridRef.current?.api?.forEachNode((node) => {
        if (
          equipmentIds.includes(node.data.chargingEquipmentId) &&
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
    // Clear organization filter for IDIR users
    if (isIDIR) {
      handleOrganizationChange(null, null)
    }
  }

  const canSubmit = selectedRows.some(
    (row) => row.status === 'Draft' || row.status === 'Updated'
  )

  const canDecommission = selectedRows.some((row) => row.status === 'Validated')

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
    <Grid container spacing={1}>
      {!isOnNestedRoute && (
        <Grid item xs={12}>
          <BCTypography variant="h5" gutterBottom>
            {isIDIR ? 'FSE index' : t('chargingEquipment:manageFSE')}
          </BCTypography>
          <BCTypography variant="body2" color="text.secondary" paragraph>
            {isIDIR
              ? 'Index of all FSE for all organizations. Processing FSE is done either through the charging site page or the compliance report.'
              : t('chargingEquipment:manageFSEDescription')}
          </BCTypography>
        </Grid>
      )}

      {!isOnNestedRoute && (
        <Grid item xs={12}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} lg={7}>
              <Stack spacing={1} direction="row">
                {!isIDIR && (
                  <BCButton
                    variant="contained"
                    size="small"
                    color="primary"
                    onClick={handleNewFSE}
                  >
                    <BCTypography variant="subtitle2">
                      {t('chargingEquipment:newFSE')}
                    </BCTypography>
                  </BCButton>
                )}
                <ClearFiltersButton onClick={handleClearFilters} />
              </Stack>
            </Grid>
            {isIDIR && (
              <Grid
                item
                xs={12}
                lg={5}
                sx={{
                  display: 'flex',
                  justifyContent: { xs: 'flex-start', lg: 'flex-end' },
                  alignItems: 'center'
                }}
              >
                <Role roles={govRoles}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <BCTypography variant="body2" color="primary">
                      Show FSE for:
                    </BCTypography>
                    <Autocomplete
                      disablePortal
                      id="fse-orgs"
                      loading={orgLoading}
                      options={filteredOrgNames}
                      value={selectedOrgOption}
                      getOptionLabel={(option) => option?.name || ''}
                      isOptionEqualToValue={(option, value) =>
                        option.organizationId === value.organizationId
                      }
                      onChange={handleOrganizationChange}
                      renderOption={renderOrganizationOption}
                      sx={({ functions: { pxToRem } }) => ({
                        width: 300,
                        '& .MuiOutlinedInput-root': { padding: pxToRem(0) }
                      })}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Select organization"
                          slotProps={{
                            htmlInput: {
                              ...params.inputProps,
                              style: { fontSize: 16, padding: '8px' }
                            }
                          }}
                        />
                      )}
                    />
                  </Box>
                </Role>
              </Grid>
            )}
          </Grid>

          <BCBox sx={{ width: '100%', minHeight: 600, mt: 2 }}>
            {!isIDIR && (
              <Box display="flex" justifyContent="flex-start" mb={2}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  sx={{ flexWrap: 'wrap' }}
                >
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
              </Box>
            )}

            <BCBox sx={{ width: '100%' }}>
              <BCGridViewer
                gridRef={gridRef}
                alertRef={alertRef}
                columnDefs={chargingEquipmentColDefs(t, isIDIR, {
                  enableSelection: true && !isIDIR,
                  showDateColumns: true,
                  showIntendedUsers: true,
                  showOrganizationColumn: isIDIR
                })}
                defaultColDef={defaultColDef}
                getRowId={getRowId}
                overlayLoadingTemplate="Loading FSE data..."
                overlayNoRowsTemplate="No FSE found"
                gridKey="charging-equipment"
                paginationOptions={paginationOptions}
                onPaginationChange={(opts) => setPaginationOptions(opts)}
                queryData={equipmentQuery}
                onRowClicked={handleRowClick}
                rowSelection="multiple"
                onSelectionChanged={handleSelectionChanged}
                suppressRowClickSelection={true}
                rowMultiSelectWithClick={false}
                highlightedRowId={highlightedId}
              />
            </BCBox>
          </BCBox>
        </Grid>
      )}

      {!isOnNestedRoute && (
        <Grid item xs={12}>
          <BCAlert2 dismissible={true} ref={alertRef} data-test="alert-box" />
        </Grid>
      )}

      {!isOnNestedRoute && !isIDIR && (
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
