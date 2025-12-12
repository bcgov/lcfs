import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { ROUTES } from '@/routes/routes'
import {
  faSquareCheck,
  faCheck,
  faUndo,
  faArrowLeft,
  faFilterCircleXmark
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Box, Grid, Stack, Card, CardContent, Chip } from '@mui/material'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { govRoles } from '@/constants/roles'
import Loading from '@/components/Loading'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { BCAlert2 } from '@/components/BCAlert'
import { useFSEProcessing } from '@/hooks/useFSEProcessing'
import { BulkProcessingModals } from './components/BulkProcessingModals'

const fseProcessingColDefs = [
  {
    field: 'status',
    headerName: 'Status',
    width: 120,
    cellRenderer: (params) => {
      const status = params.value
      const color =
        {
          Draft: 'default',
          Submitted: 'info',
          Validated: 'success',
          Updated: 'warning'
        }[status] || 'default'
      return <Chip label={status} color={color} size="small" />
    }
  },
  {
    field: 'registration_number',
    headerName: 'Registration #',
    width: 150,
    sortable: true,
    filter: true
  },
  {
    field: 'version',
    headerName: 'Ver.',
    width: 70,
    type: 'number'
  },
  {
    field: 'allocating_organization_name',
    headerName: 'Allocating Organization',
    width: 200,
    filter: true
  },
  {
    field: 'serial_number',
    headerName: 'Serial #',
    width: 120,
    filter: true
  },
  {
    field: 'manufacturer',
    headerName: 'Manufacturer',
    width: 140,
    filter: true
  },
  {
    field: 'model',
    headerName: 'Model',
    width: 120,
    filter: true
  },
  {
    field: 'level_of_equipment_name',
    headerName: 'Level of Equipment',
    width: 160,
    filter: true
  }
]

const defaultSortModel = [{ colId: 'registration_number', sort: 'asc' }]

const initialPaginationOptions = {
  page: 1,
  size: 25,
  sortOrders: defaultSortModel,
  filters: []
}

export const FSEProcessing = () => {
  const { t } = useTranslation(['common', 'chargingEquipment'])
  const navigate = useNavigate()
  const location = useLocation()
  const { siteId } = useParams()
  const gridRef = useRef()
  const alertRef = useRef(null)
  const isProgrammaticSelection = useRef(false)
  const { data: currentUser, hasAnyRole, hasRoles } = useCurrentUser()
  const isIDIR = hasAnyRole(...govRoles)

  // Alerts now use BCAlert2 via alertRef
  const [selectedRows, setSelectedRows] = useState([])
  const [showValidateModal, setShowValidateModal] = useState(false)
  const [showReturnToDraftModal, setShowReturnToDraftModal] = useState(false)
  const [selectMode, setSelectMode] = useState(null) // 'submitted' or null

  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )

  const {
    data: processingData,
    isLoading,
    isError,
    error,
    refetch
  } = useFSEProcessing(siteId)

  const { validateEquipment, returnToDraft, isValidating, isReturningToDraft } =
    useFSEProcessing()

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

  const handleBack = () => {
    navigate(ROUTES.REPORTS.CHARGING_SITE.INDEX)
  }

  const handleSelectAllSubmitted = () => {
    // Ensure grid API is available
    if (!gridRef.current?.api) {
      return
    }

    if (selectMode === 'submitted') {
      // Deselect all
      isProgrammaticSelection.current = true
      gridRef.current.api.deselectAll()
      setSelectMode(null)
      setTimeout(() => {
        isProgrammaticSelection.current = false
      }, 150)
    } else {
      // Select all Submitted rows
      isProgrammaticSelection.current = true
      // Clear any existing selections first
      gridRef.current.api.deselectAll()
      // Set mode state before starting selections
      setSelectMode('submitted')
      // Use a small delay to ensure deselectAll completes
      setTimeout(() => {
        gridRef.current.api.forEachNode((node) => {
          if (node.data.status === 'Submitted') {
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

  const handleSelectionChanged = (event) => {
    const selectedNodes = event.api.getSelectedNodes()
    setSelectedRows(selectedNodes.map((node) => node.data))

    // Skip mode reconciliation while running programmatic select-all
    if (isProgrammaticSelection.current) return

    // Clear select mode if manual selection doesn't match the mode
    const selectedData = selectedNodes.map((node) => node.data)
    const allSubmitted = selectedData.every((row) => row.status === 'Submitted')

    if (!allSubmitted && selectMode === 'submitted') {
      setSelectMode(null)
    }
  }

  const handleBulkValidate = async () => {
    const equipmentIds = selectedRows.map((row) => row.charging_equipment_id)
    try {
      const result = await validateEquipment(equipmentIds)
      alertRef.current?.triggerAlert({
        message: result.message,
        severity: 'success'
      })
      // Optimistically update grid statuses
      gridRef.current?.api?.forEachNode((node) => {
        if (
          equipmentIds.includes(node.data.charging_equipment_id) &&
          node.data.status === 'Submitted'
        ) {
          node.updateData({ ...node.data, status: 'Validated' })
        }
      })
      setShowValidateModal(false)
      setSelectMode(null)
      refetch()
      gridRef.current?.api?.deselectAll()
    } catch (error) {
      alertRef.current?.triggerAlert({
        message: error.message || 'Failed to validate equipment',
        severity: 'error'
      })
    }
  }

  const handleBulkReturnToDraft = async () => {
    const equipmentIds = selectedRows.map((row) => row.charging_equipment_id)
    try {
      const result = await returnToDraft(equipmentIds)
      alertRef.current?.triggerAlert({
        message: result.message,
        severity: 'success'
      })
      // Optimistically update grid statuses
      gridRef.current?.api?.forEachNode((node) => {
        if (
          equipmentIds.includes(node.data.charging_equipment_id) &&
          (node.data.status === 'Submitted' || node.data.status === 'Validated')
        ) {
          node.updateData({ ...node.data, status: 'Draft' })
        }
      })
      setShowReturnToDraftModal(false)
      setSelectMode(null)
      refetch()
      gridRef.current?.api?.deselectAll()
    } catch (error) {
      alertRef.current?.triggerAlert({
        message: error.message || 'Failed to return equipment to draft',
        severity: 'error'
      })
    }
  }

  const handleClearFilters = () => {
    setPaginationOptions(initialPaginationOptions)
    gridRef.current?.api?.setFilterModel(null)
  }

  const handleRowClick = (params) => {
    // Ignore clicks on the checkbox selection column
    const colId = params?.column?.getColId?.()
    if (colId === '__select__') return

    // For BCeID users, navigate to the edit page
    const { charging_equipment_id } = params.data
    navigate(ROUTES.REPORTS.EDIT_FSE.replace(':fseId', charging_equipment_id), {
      state: { returnTo: location.pathname }
    })
  }

  const canValidate = selectedRows.some((row) => row.status === 'Submitted')
  const canReturnToDraft = selectedRows.some(
    (row) => row.status === 'Submitted' || row.status === 'Validated'
  )

  if (isLoading) return <Loading />
  if (isError) {
    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <BCTypography variant="h5" gutterBottom>
            FSE Processing
          </BCTypography>
          <BCAlert severity="error">
            Error loading FSE processing data
            <br />
            <small>
              Please check if the backend service is running properly.
            </small>
          </BCAlert>
        </Grid>
      </Grid>
    )
  }

  const { site, equipment } = processingData || {}

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <BCButton
            variant="outlined"
            color="primary"
            size="medium"
            startIcon={<FontAwesomeIcon icon={faArrowLeft} />}
            onClick={handleBack}
          >
            Back to Charging Sites
          </BCButton>
          <BCTypography variant="h5" gutterBottom sx={{ margin: 0 }}>
            Charging site/FSE processing
          </BCTypography>
        </Box>
      </Grid>

      <Grid item xs={12}>
        <BCAlert2 dismissible={true} ref={alertRef} data-test="alert-box" />
      </Grid>

      {/* Charging Site Details */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <BCTypography variant="h6" color="primary" gutterBottom>
              Charging site
            </BCTypography>
            <BCTypography variant="h4" gutterBottom>
              {site?.site_name}
            </BCTypography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <BCTypography variant="body2" color="text.secondary">
                  Status:
                </BCTypography>
                <Chip
                  label={site?.status}
                  color={site?.status === 'Submitted' ? 'info' : 'default'}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <BCTypography variant="body2" color="text.secondary">
                  Version number:
                </BCTypography>
                <BCTypography variant="body1">{site?.version}</BCTypography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <BCTypography variant="body2" color="text.secondary">
                  Site number:
                </BCTypography>
                <BCTypography variant="body1">{site?.site_code}</BCTypography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <BCTypography variant="body2" color="text.secondary">
                  Organization:
                </BCTypography>
                <BCTypography variant="body1">
                  {site?.organization}
                </BCTypography>
              </Grid>
              <Grid item xs={12} sm={6} md={6}>
                <BCTypography variant="body2" color="text.secondary">
                  Site Address:
                </BCTypography>
                <BCTypography variant="body1">
                  {site?.site_address}, {site?.city}, {site?.postal_code}
                </BCTypography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <BCTypography variant="body2" color="text.secondary">
                  Intended users:
                </BCTypography>
                <Box display="flex" gap={0.5} flexWrap="wrap">
                  {site?.intended_uses?.map((use, idx) => (
                    <Chip key={idx} label={use.type} size="small" />
                  ))}
                </Box>
              </Grid>
            </Grid>
            {site?.site_notes && (
              <Box mt={2}>
                <BCTypography variant="body2" color="text.secondary">
                  Site notes:
                </BCTypography>
                <BCTypography variant="body1">{site?.site_notes}</BCTypography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* FSE Processing Section */}
      <Grid item xs={12}>
        <BCTypography variant="h6" gutterBottom>
          FSE processing
        </BCTypography>
        <BCTypography variant="body2" color="text.secondary" paragraph>
          Set FSE as validated or return to draft for the supplier to make
          further changes. The Set/Return button will only apply to the visible
          rows. Use the site name filter and/or paging to assist.
        </BCTypography>

        <BCBox sx={{ width: '100%', height: '100%' }}>
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
                startIcon={<FontAwesomeIcon icon={faSquareCheck} />}
                onClick={handleSelectAllSubmitted}
              >
                Select all submitted
              </BCButton>

              <BCButton
                variant="outlined"
                color="success"
                size="medium"
                startIcon={<FontAwesomeIcon icon={faCheck} />}
                onClick={() => setShowValidateModal(true)}
                disabled={selectedRows.length === 0 || !canValidate}
              >
                Set selected as validated
              </BCButton>

              <BCButton
                variant="outlined"
                color="warning"
                size="medium"
                startIcon={<FontAwesomeIcon icon={faUndo} />}
                onClick={() => setShowReturnToDraftModal(true)}
                disabled={selectedRows.length === 0 || !canReturnToDraft}
              >
                Return selected to draft
              </BCButton>
            </Stack>

            <ClearFiltersButton onClick={handleClearFilters} />
          </Box>

          <BCBox sx={{ width: '100%' }}>
            <BCGridViewer
              gridRef={gridRef}
              alertRef={alertRef}
              columnDefs={fseProcessingColDefs}
              defaultColDef={defaultColDef}
              getRowId={getRowId}
              overlayLoadingTemplate="Loading FSE data..."
              overlayNoRowsTemplate="No FSE found"
              gridKey="fse-processing"
              paginationOptions={paginationOptions}
              onPaginationChange={(opts) => setPaginationOptions(opts)}
              queryData={{
                data: {
                  items: equipment?.items || [],
                  total_count: equipment?.total_count || 0
                },
                isLoading,
                isError,
                error
              }}
              onRowClicked={isIDIR ? undefined : handleRowClick}
              rowSelection="multiple"
              onSelectionChanged={handleSelectionChanged}
              suppressRowClickSelection={true}
              rowMultiSelectWithClick={false}
            />
          </BCBox>
        </BCBox>
      </Grid>

      <BulkProcessingModals
        showValidateModal={showValidateModal}
        showReturnToDraftModal={showReturnToDraftModal}
        selectedCount={selectedRows.length}
        onValidateConfirm={handleBulkValidate}
        onReturnToDraftConfirm={handleBulkReturnToDraft}
        onValidateCancel={() => setShowValidateModal(false)}
        onReturnToDraftCancel={() => setShowReturnToDraftModal(false)}
        isValidating={isValidating}
        isReturningToDraft={isReturningToDraft}
      />
    </Grid>
  )
}
