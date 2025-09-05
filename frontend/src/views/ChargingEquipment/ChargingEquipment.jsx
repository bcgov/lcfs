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
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  const gridRef = useRef()
  const { data: currentUser, hasAnyRole, hasRoles } = useCurrentUser()

  const [searchParams, setSearchParams] = useSearchParams()
  const highlightedId = searchParams.get('hid')

  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [selectedRows, setSelectedRows] = useState([])
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showDecommissionModal, setShowDecommissionModal] = useState(false)

  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )

  const {
    data: equipmentData,
    isLoading,
    isError,
    refetch
  } = useChargingEquipment(paginationOptions)

  const {
    submitEquipment,
    decommissionEquipment,
    isSubmitting,
    isDecommissioning
  } = useChargingEquipment()

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
    navigate(ROUTES.CHARGING_EQUIPMENT.NEW)
  }

  const handleRowClick = (params) => {
    const { status, charging_equipment_id } = params.data
    if (status === 'Draft' || status === 'Updated' || status === 'Validated') {
      navigate(ROUTES.CHARGING_EQUIPMENT.EDIT.replace(':id', charging_equipment_id))
    } else {
      navigate(ROUTES.CHARGING_EQUIPMENT.VIEW.replace(':id', charging_equipment_id))
    }
  }

  const handleSelectionChanged = (event) => {
    const selectedNodes = event.api.getSelectedNodes()
    setSelectedRows(selectedNodes.map(node => node.data))
  }

  const handleBulkSubmit = async () => {
    const equipmentIds = selectedRows.map(row => row.charging_equipment_id)
    try {
      const result = await submitEquipment(equipmentIds)
      setAlertMessage(result.message)
      setAlertSeverity('success')
      setShowSubmitModal(false)
      refetch()
      gridRef.current?.api?.deselectAll()
    } catch (error) {
      setAlertMessage(error.message || 'Failed to submit equipment')
      setAlertSeverity('error')
    }
  }

  const handleBulkDecommission = async () => {
    const equipmentIds = selectedRows.map(row => row.charging_equipment_id)
    try {
      const result = await decommissionEquipment(equipmentIds)
      setAlertMessage(result.message)
      setAlertSeverity('success')
      setShowDecommissionModal(false)
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

  const canSubmit = selectedRows.some(row => 
    row.status === 'Draft' || row.status === 'Updated'
  )

  const canDecommission = selectedRows.some(row => 
    row.status === 'Validated'
  )

  if (isLoading) return <Loading />
  if (isError) {
    return (
      <BCAlert severity="error">
        {t('chargingEquipment:errorLoadingEquipment')}
      </BCAlert>
    )
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <BCTypography variant="h5" gutterBottom>
          {t('chargingEquipment:manageFSE')}
        </BCTypography>
        <BCTypography variant="body1" color="text.secondary" paragraph>
          {t('chargingEquipment:manageFSEDescription')}
        </BCTypography>
      </Grid>

      {alertMessage && (
        <Grid item xs={12}>
          <BCAlert 
            severity={alertSeverity}
            onClose={() => setAlertMessage('')}
          >
            {alertMessage}
          </BCAlert>
        </Grid>
      )}

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
            rowData={equipmentData?.items || []}
            columnDefs={chargingEquipmentColDefs}
            defaultColDef={defaultColDef}
            getRowId={getRowId}
            overlayLoadingTemplate="Loading FSE data..."
            overlayNoRowsTemplate="No FSE found"
            pagination={true}
            paginationPageSize={paginationOptions.size}
            currentPage={paginationOptions.page}
            totalPages={equipmentData?.total_pages || 1}
            totalCount={equipmentData?.total_count || 0}
            onPaginationChanged={(page, size) => {
              setPaginationOptions(prev => ({ ...prev, page, size }))
            }}
            onSortChanged={(sortModel) => {
              setPaginationOptions(prev => ({ ...prev, sortOrders: sortModel }))
            }}
            onFilterChanged={(filterModel) => {
              setPaginationOptions(prev => ({ ...prev, filters: filterModel }))
            }}
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
    </Grid>
  )
}