import React, { useState, useRef, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { CommonArrayRenderer } from '@/utils/grid/cellRenderers'
import {
  Grid2 as Grid,
  Box,
  Stack,
  Checkbox,
  FormControlLabel,
  Typography,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton
} from '@mui/material'
import {
  ExpandMore,
  Edit,
  CheckBox,
  CheckCircle,
  Undo,
  ArrowBack
} from '@mui/icons-material'

import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import BCBox from '@/components/BCBox'
import BCBadge from '@/components/BCBadge'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import colors from '@/themes/base/colors'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog'
import {
  useGetChargingSiteById,
  useBulkUpdateEquipmentStatus,
  useChargingSiteEquipmentPaginated
} from '@/hooks/useChargingSite'
import { useDownloadDocument } from '@/hooks/useDocuments'
import Loading from '@/components/Loading'

export const ChargingSiteEquipmentProcessing = () => {
  const { siteId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation(['common', 'chargingSite'])
  const gridRef = useRef(null)
  const alertRef = useRef(null)

  const [selectedRows, setSelectedRows] = useState([])
  const [isFileDialogOpen, setFileDialogOpen] = useState(false)
  const [isAttachmentsExpanded, setIsAttachmentsExpanded] = useState(true)
  const [paginationOptions, setPaginationOptions] = useState({
    page: 1,
    size: 10,
    sortOrders: [],
    filters: []
  })

  const accordionStyles = useMemo(
    () => ({
      '& .Mui-disabled': {
        backgroundColor: colors.light.main,
        opacity: '0.8 !important',
        '& .MuiTypography-root': {
          color: 'initial !important'
        }
      }
    }),
    []
  )

  const chargingSiteQuery = useGetChargingSiteById(siteId)
  const { data: chargingSite, isLoading: isSiteLoading } = chargingSiteQuery

  const equipmentQuery = useChargingSiteEquipmentPaginated(
    siteId,
    paginationOptions
  )
  const { data: equipmentData, isLoading: isEquipmentLoading } = equipmentQuery

  const { mutateAsync: bulkUpdateStatus, isPending: isUpdating } =
    useBulkUpdateEquipmentStatus()

  const downloadDocument = useDownloadDocument('charging_site', siteId)

  const equipmentList = equipmentData?.equipment || []
  const attachments = chargingSite?.attachments || []
  const isLoading = isSiteLoading || isEquipmentLoading

  // Check if selected equipment can be returned to draft (only from Submitted status)
  const canReturnToDraft = useMemo(() => {
    if (selectedRows.length === 0) return false

    const selectedEquipment = equipmentList.filter((eq) =>
      selectedRows.includes(eq.chargingEquipmentId)
    )

    return selectedEquipment.every((eq) => eq.status === 'Submitted')
  }, [selectedRows, equipmentList])

  // Check if selected equipment can be returned to submitted (undo validation - only from Validated status)
  const canUndoValidation = useMemo(() => {
    if (selectedRows.length === 0) return false

    const selectedEquipment = equipmentList.filter((eq) =>
      selectedRows.includes(eq.chargingEquipmentId)
    )

    return selectedEquipment.every((eq) => eq.status === 'Validated')
  }, [selectedRows, equipmentList])

  // Check if selected equipment can be validated (only from Submitted status)
  const canValidate = useMemo(() => {
    if (selectedRows.length === 0) return false

    const selectedEquipment = equipmentList.filter((eq) =>
      selectedRows.includes(eq.chargingEquipmentId)
    )

    return selectedEquipment.every((eq) => eq.status === 'Submitted')
  }, [selectedRows, equipmentList])

  // Handle row selection for bulk operations
  const handleSelectionChanged = useCallback((api) => {
    const selectedNodes = api.getSelectedNodes()
    const selectedIds = selectedNodes.map(
      (node) => node.data.chargingEquipmentId
    )
    setSelectedRows(selectedIds)
  }, [])

  // Select all submitted equipment
  const handleSelectAllSubmitted = useCallback(() => {
    const submittedEquipment = equipmentList.filter(
      (equipment) => equipment.status === 'Submitted'
    )
    const submittedIds = submittedEquipment.map(
      (equipment) => equipment.chargingEquipmentId
    )
    setSelectedRows(submittedIds)

    // Update grid selection
    if (gridRef.current) {
      gridRef.current.api.forEachNode((node) => {
        const isSelected = submittedIds.includes(node.data.chargingEquipmentId)
        node.setSelected(isSelected)
      })
    }
  }, [equipmentList])

  // Handle pagination changes
  const handlePaginationChange = useCallback((newPaginationOptions) => {
    setPaginationOptions(newPaginationOptions)
    setSelectedRows([])
  }, [])

  // Clear all selections and filters
  const handleClearFilters = useCallback(() => {
    setSelectedRows([])
    // Reset pagination options to clear backend filters
    setPaginationOptions((prev) => ({
      ...prev,
      page: 1,
      filters: [],
      sortOrders: []
    }))
    if (gridRef.current && gridRef.current.api) {
      // Clear all column filters
      gridRef.current.api.setFilterModel(null)
      // Clear row selections
      gridRef.current.api.deselectAll()
      // Clear sorting
      gridRef.current.api.setSortModel(null)
    }
  }, [setPaginationOptions])

  // File dialog handlers
  const handleFileDialogOpen = useCallback(() => {
    setFileDialogOpen(true)
  }, [])

  const handleFileDialogClose = useCallback(() => {
    setFileDialogOpen(false)
  }, [])

  // Handle attachments accordion toggle
  const handleAttachmentsAccordionChange = useCallback((event, isExpanded) => {
    setIsAttachmentsExpanded(isExpanded)
  }, [])

  // Bulk status update handlers
  const handleBulkStatusUpdate = useCallback(
    async (newStatus) => {
      if (selectedRows.length === 0) return

      try {
        await bulkUpdateStatus({
          siteId,
          equipment_ids: selectedRows,
          new_status: newStatus
        })
        // Clear selection after successful update
        handleClearFilters()
      } catch (error) {
        console.error('Failed to update equipment status:', error)
      }
    },
    [selectedRows, siteId, bulkUpdateStatus, handleClearFilters]
  )

  // Column definitions for the equipment data grid
  const columnDefs = useMemo(
    () => [
      {
        headerName: '',
        field: 'select',
        checkboxSelection: true,
        headerCheckboxSelection: true,
        width: 50,
        pinned: 'left',
        lockPinned: true,
        filter: false
      },
      {
        headerName: t('chargingSite:equipment.status'),
        field: 'status',
        width: 175,
        filter: false
      },
      {
        headerName: t('chargingSite:equipment.registrationNumber'),
        field: 'registrationNumber',
        width: 160,
        filter: false
      },
      {
        headerName: t('chargingSite:equipment.versionNumber'),
        field: 'version',
        width: 175,
        type: 'numericColumn',
        filter: false
      },
      {
        headerName: t('chargingSite:equipment.allocatingOrganization'),
        field: 'allocatingOrganization',
        width: 250,
        filter: true
      },
      {
        headerName: t('chargingSite:equipment.serialNumber'),
        field: 'serialNumber',
        width: 200,
        filter: true
      },
      {
        headerName: t('chargingSite:equipment.manufacturer'),
        field: 'manufacturer',
        width: 200,
        filter: true
      },
      {
        headerName: t('chargingSite:equipment.model'),
        field: 'model',
        width: 200,
        filter: false
      },
      {
        headerName: t('chargingSite:equipment.levelOfEquipment'),
        field: 'levelOfEquipment',
        width: 375,
        filter: false
      },
      {
        headerName: t('chargingSite:equipment.ports'),
        field: 'ports',
        width: 150,
        filter: false
      },
      {
        colId: 'intendedUseTypes',
        field: 'intendedUseTypes',
        headerName: t('chargingSite:equipment.intendedUseTypes'),
        valueGetter: (params) =>
          params.data.intendedUseTypes &&
          params.data.intendedUseTypes.length > 0
            ? params.data.intendedUseTypes.join(', ')
            : '',
        width: 400,
        sortable: false,
        suppressHeaderMenuButton: true,
        filter: false,
        cellRenderer: CommonArrayRenderer,
        cellClass: 'vertical-middle'
      },
      {
        headerName: t('chargingSite:equipment.latitude'),
        field: 'latitude',
        width: 150,
        type: 'numericColumn',
        filter: false
      },
      {
        headerName: t('chargingSite:equipment.longitude'),
        field: 'longitude',
        width: 150,
        type: 'numericColumn',
        filter: false
      },
      {
        headerName: t('chargingSite:equipment.equipmentNotes'),
        field: 'equipmentNotes',
        width: 500,
        filter: false
      }
    ],
    [t]
  )

  const gridOptions = useMemo(
    () => ({
      rowSelection: 'multiple',
      suppressRowClickSelection: true,
      onSelectionChanged: (event) => handleSelectionChanged(event.api),
      getRowId: (params) => params.data.chargingEquipmentId
    }),
    [handleSelectionChanged]
  )

  if (isLoading) {
    return <Loading />
  }

  if (!chargingSite) {
    return (
      <BCBox>
        <BCTypography variant="h5" color="error">
          {t('chargingSite:messages.siteNotFound')}
        </BCTypography>
      </BCBox>
    )
  }

  return (
    <>
      <BCTypography variant="h5" color="primary">
        {t('chargingSite:title')}
      </BCTypography>
      <Grid
        container
        spacing={1}
        sx={{
          p: { xs: 1, sm: 2 },
          mt: { xs: 3, sm: 5 }
        }}
      >
        {/* Charging Site Details */}
        <Grid size={{ xs: 12, md: 9 }}>
          <BCWidgetCard
            title={t('chargingSite:chargingSiteTitle')}
            content={
              <Grid container spacing={2}>
                <Grid xs={12} md={6}>
                  <BCTypography variant="h5" color="primary">
                    {chargingSite.site_name}
                  </BCTypography>
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    <BCTypography variant="body2">
                      <strong>{t('chargingSite:site.status')}:</strong>{' '}
                      {chargingSite.status?.status || chargingSite.status}
                    </BCTypography>
                    <BCTypography variant="body2">
                      <strong>{t('chargingSite:site.versionNumber')}:</strong>{' '}
                      {chargingSite.version}
                    </BCTypography>
                    <BCTypography variant="body2">
                      <strong>{t('chargingSite:site.siteNumber')}:</strong>{' '}
                      {chargingSite.siteCode}
                    </BCTypography>
                    <BCTypography variant="body2">
                      <strong>{t('chargingSite:site.siteNotes')}:</strong>{' '}
                      {chargingSite.notes || 'NE corner'}
                    </BCTypography>
                  </Stack>
                </Grid>
                <Grid xs={12} md={6}>
                  <Stack spacing={0.5}>
                    <BCTypography variant="body2">
                      <strong>{t('chargingSite:site.organization')}:</strong>{' '}
                      {chargingSite.organizationName}
                    </BCTypography>
                    <BCTypography variant="body2">
                      <strong>{t('chargingSite:site.siteAddress')}:</strong>{' '}
                      {chargingSite.streetAddress}, {chargingSite.city},{' '}
                      {chargingSite.postalCode}
                    </BCTypography>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        flexWrap: 'wrap'
                      }}
                    >
                      <BCTypography variant="body2">
                        <strong>{t('chargingSite:site.intendedUsers')}:</strong>
                      </BCTypography>
                      {chargingSite.intendedUsers &&
                      chargingSite.intendedUsers.length > 0 ? (
                        chargingSite.intendedUsers.map((user, index) => (
                          <BCBadge
                            key={user.endUserTypeId}
                            sx={{
                              '& .MuiBadge-badge': {
                                fontWeight: 'regular',
                                fontSize: '0.9rem',
                                padding: '0.4em 0.6em'
                              },
                              margin: '2px'
                            }}
                            badgeContent={user.typeName}
                            color="primary"
                            variant="outlined"
                            size="md"
                          />
                        ))
                      ) : (
                        <BCTypography variant="body2" color="textSecondary">
                          {t('chargingSite:noIntendedUsers')}
                        </BCTypography>
                      )}
                    </Box>
                  </Stack>
                </Grid>
              </Grid>
            }
          />
        </Grid>

        {/* Attachments Section */}
        <Grid size={{ xs: 12, md: 12 }}>
          <Accordion
            sx={accordionStyles}
            expanded={isAttachmentsExpanded}
            onChange={handleAttachmentsAccordionChange}
          >
            <AccordionSummary
              expandIcon={<ExpandMore sx={{ width: '32px', height: '32px' }} />}
              aria-controls="attachments-content"
              id="attachments-header"
              sx={{
                '& .MuiAccordionSummary-content': { alignItems: 'center' }
              }}
            >
              <BCTypography
                style={{ display: 'flex', alignItems: 'center' }}
                variant="h6"
                color="primary"
                component="div"
              >
                {t('chargingSite:attachmentsTitle')}&nbsp;&nbsp;
                <IconButton
                  color="primary"
                  aria-label="edit"
                  sx={{ px: 2 }}
                  className="small-icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleFileDialogOpen()
                  }}
                >
                  <Edit sx={{ width: '24px', height: '24px' }} />
                </IconButton>
              </BCTypography>
            </AccordionSummary>
            <AccordionDetails>
              {attachments.length > 0 ? (
                <ul
                  style={{ paddingLeft: '20px', marginTop: 0, marginBottom: 0 }}
                >
                  {attachments.map((attachment, index) => (
                    <li key={index} style={{ marginBottom: '8px' }}>
                      <BCTypography
                        variant="body2"
                        sx={{ color: '#1976d2', cursor: 'pointer' }}
                        onClick={async () => {
                          try {
                            await downloadDocument(attachment.documentId)
                          } catch (error) {
                            console.error('Error downloading document:', error)
                          }
                        }}
                      >
                        {attachment.fileName}
                      </BCTypography>
                    </li>
                  ))}
                </ul>
              ) : (
                <BCTypography variant="body2" color="textSecondary">
                  {t('chargingSite:noAttachments')}
                </BCTypography>
              )}
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* Equipment Processing Section */}
        <Grid size={12} sx={{ mt: { xs: 2, md: 4 } }}>
          <Box sx={{ mb: 3 }}>
            <BCTypography variant="h6" sx={{ mb: 1 }}>
              {t('chargingSite:equipmentProcessingTitle')}
            </BCTypography>
            <BCTypography variant="body2" color="textSecondary">
              {t('chargingSite:equipmentProcessingDescription')}
            </BCTypography>
          </Box>

          {/* Action Buttons */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ mb: 3, flexWrap: 'wrap' }}
          >
            <BCButton
              variant="contained"
              color="primary"
              type="button"
              startIcon={<CheckBox sx={{ width: '24px', height: '24px' }} />}
              onClick={handleSelectAllSubmitted}
              disabled={
                equipmentList.filter((e) => e.status === 'Submitted').length ===
                0
              }
            >
              {t('chargingSite:buttons.selectAllSubmitted')}
            </BCButton>
            <BCButton
              variant="outlined"
              color="primary"
              type="button"
              onClick={() => handleBulkStatusUpdate('Validated')}
              disabled={selectedRows.length === 0 || isUpdating || !canValidate}
              title={
                selectedRows.length > 0 && !canValidate
                  ? t('chargingSite:tooltips.onlySubmittedCanBeValidated')
                  : ''
              }
            >
              {t('chargingSite:buttons.setSelectedAsValidated')}
            </BCButton>
            <BCButton
              variant="outlined"
              color="warning"
              type="button"
              onClick={() => handleBulkStatusUpdate('Submitted')}
              disabled={
                selectedRows.length === 0 || isUpdating || !canUndoValidation
              }
              title={
                selectedRows.length > 0 && !canUndoValidation
                  ? t('chargingSite:tooltips.onlyValidatedCanBeReturned')
                  : ''
              }
            >
              {t('chargingSite:buttons.undoValidation')}
            </BCButton>
            <BCButton
              variant="outlined"
              color="error"
              type="button"
              onClick={() => handleBulkStatusUpdate('Draft')}
              disabled={
                selectedRows.length === 0 || isUpdating || !canReturnToDraft
              }
              title={
                selectedRows.length > 0 && !canReturnToDraft
                  ? t('chargingSite:tooltips.onlySubmittedCanBeDraft')
                  : ''
              }
            >
              {t('chargingSite:buttons.returnSelectedToDraft')}
            </BCButton>
            <ClearFiltersButton onClick={handleClearFilters} size="medium" />
          </Stack>

          {/* Data Grid */}
          <BCBox sx={{ width: '100%' }}>
            <BCGridViewer
              gridRef={gridRef}
              alertRef={alertRef}
              columnDefs={columnDefs}
              queryData={equipmentQuery}
              dataKey="equipment"
              paginationOptions={paginationOptions}
              onPaginationChange={handlePaginationChange}
              gridOptions={gridOptions}
              enableCopyButton={false}
              gridKey="charging-site-equipment"
              defaultColDef={{
                sortable: true,
                resizable: true,
                minWidth: 100,
                width: 140,
                flex: 0
              }}
            />
          </BCBox>
        </Grid>

        {/* Document Upload Dialog */}
        <DocumentUploadDialog
          parentID={siteId}
          parentType="charging_site"
          open={isFileDialogOpen}
          close={handleFileDialogClose}
        />
      </Grid>
    </>
  )
}

ChargingSiteEquipmentProcessing.displayName = 'ChargingSiteEquipmentProcessing'
