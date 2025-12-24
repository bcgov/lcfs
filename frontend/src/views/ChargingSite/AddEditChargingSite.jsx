import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BCTypography from '@/components/BCTypography'
import Grid2 from '@mui/material/Grid2'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faUpload } from '@fortawesome/free-solid-svg-icons'

import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import { defaultColDef, chargingSiteColDefs } from './components/_schema'
import { v4 as uuid } from 'uuid'
import { ROUTES } from '@/routes/routes'
import { handleScheduleDelete, handleScheduleSave } from '@/utils/schedules'
import { isArrayEmpty } from '@/utils/array'
import { useApiService } from '@/services/useApiService'
import { apiRoutes } from '@/constants/routes/index'
import BCButton from '@/components/BCButton/index.jsx'
import ImportDialog from '@/components/ImportDialog'

import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config'
import {
  useSaveChargingSite,
  useGetAllocationOrganizations,
  useImportChargingSites,
  useGetChargingSitesImportJobStatus
} from '@/hooks/useChargingSite'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export const AddEditChargingSite = ({
  isEditMode = false,
  setIsEditMode,
  data,
  refetch
}) => {
  const [rowData, setRowData] = useState([])
  const gridRef = useRef(null)
  const [errors, setErrors] = useState({})
  const [warnings, setWarnings] = useState({})
  const [columnDefs, setColumnDefs] = useState([])
  const [isGridReady, setGridReady] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isOverwrite, setIsOverwrite] = useState(false)
  const apiService = useApiService()

  const alertRef = useRef()
  const importResultAppliedRef = useRef(false)
  const lastImportSummaryRef = useRef(null)
  const location = useLocation()
  const { t } = useTranslation(['common', 'chargingSite'])

  const { data: currentUser, hasRoles } = useCurrentUser()

  const organizationId = useMemo(
    () => currentUser?.organization?.organizationId ?? null,
    [currentUser]
  )
  const navigate = useNavigate()

  const {
    data: allocationOrganizations,
    isLoading: optionsLoading,
    isFetched
  } = useGetAllocationOrganizations()

  const { mutateAsync: saveRow } = useSaveChargingSite(organizationId)

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('chargingSite:noSitesFound'),
      autoSizeStrategy: {
        type: 'fitCellContents',
        defaultMinWidth: 50,
        defaultMaxWidth: 600
      }
    }),
    [t]
  )

  useEffect(() => {
    if (location.state?.message) {
      alertRef.current?.triggerAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
    }
  }, [location.state])

  const onGridReady = () => {
    setGridReady(true)
  }

  useEffect(() => {
    if (!isGridReady) return

    if (
      isEditMode &&
      data &&
      (rowData.length !== 1 ||
        rowData[0]?.chargingSiteId !== data.chargingSiteId)
    ) {
      setRowData([{ ...data, id: uuid() }])
    } else if (!isEditMode && isArrayEmpty(rowData)) {
      setRowData([
        {
          id: uuid(),
          chargingSiteId: null,
          organizationId
        }
      ])
    }

    const gridApi = gridRef.current?.api
    gridApi?.sizeColumnsToFit()

    const timeout = setTimeout(() => {
      const lastRowIndex = gridApi?.getLastDisplayedRowIndex?.()
      if (typeof lastRowIndex === 'number') {
        gridApi.startEditingCell({
          rowIndex: lastRowIndex,
          colKey: 'siteName'
        })
      }
    }, 100)

    return () => clearTimeout(timeout)
  }, [isGridReady, isEditMode, data, rowData, organizationId])

  useEffect(() => {
    if (!optionsLoading && Array.isArray(allocationOrganizations)) {
      const updatedColumnDefs = chargingSiteColDefs(
        allocationOrganizations,
        errors,
        warnings,
        isGridReady
      )
      setColumnDefs(updatedColumnDefs)
    }
  }, [errors, warnings, allocationOrganizations, isGridReady])

  const onFirstDataRendered = useCallback((params) => {
    params.api?.autoSizeAllColumns?.()
  }, [])

  const onCellEditingStopped = useCallback(
    async (params) => {
      if (params.oldValue === params.newValue) return

      params.node.updateData({
        ...params.node.data,
        validationStatus: 'pending'
      })

      alertRef.current?.triggerAlert({
        message: 'Updating row...',
        severity: 'pending'
      })

      // clean up any null or empty string values, but preserve allocatingOrganizationId
      // even when null (to properly clear it when user enters free text)
      const updatedData = {
        ...Object.entries(params.node.data)
          .filter(([key, value]) => {
            // Always include allocatingOrganizationId (even when null) to properly clear it
            if (key === 'allocatingOrganizationId') return true
            return value !== null && value !== '' && value !== undefined
          })
          .reduce((acc, [key, value]) => {
            acc[key] = value
            return acc
          }, {}),
        currentStatus: 'Draft',
        organizationId
      }

      const responseData = await handleScheduleSave({
        alertRef,
        idField: 'chargingSiteId',
        labelPrefix: 'chargingSite:columnLabels',
        params,
        setErrors,
        setWarnings,
        saveRow,
        t,
        updatedData
      })

      // Only clear alert and set to valid if the save was successful
      if (responseData.validationStatus === 'success') {
        alertRef.current?.clearAlert()
        params.node.updateData({ ...responseData, validationStatus: 'valid' })
      } else {
        // Update with error/warning status but keep the alert visible
        params.node.updateData({ ...responseData })
      }
      params.api?.autoSizeAllColumns?.()
    },
    [saveRow, t]
  )

  const onAction = useCallback(
    async (action, params) => {
      if (action !== 'delete') {
        return
      }

      const deletionSucceeded = await handleScheduleDelete(
        params,
        'chargingSiteId',
        saveRow,
        alertRef,
        setRowData,
        {
          organizationId
        }
      )

      if (deletionSucceeded && isEditMode && params?.node?.data?.chargingSiteId) {
        const successMessage = t('chargingSite:messages.siteDeleted', {
          defaultValue: 'Charging site deleted successfully.'
        })

        navigate(ROUTES.REPORTS.CHARGING_SITE.INDEX, {
          replace: true,
          state: {
            message: successMessage,
            severity: 'success'
          }
        })
      }
    },
    [alertRef, isEditMode, navigate, organizationId, saveRow, setRowData, t]
  )

  const handleDownload = async () => {
    if (!organizationId) {
      return
    }

    try {
      setIsDownloading(true)
      const endpoint = apiRoutes.downloadChargingSitesTemplate.replace(
        ':orgID',
        organizationId
      )

      await apiService.download({ url: endpoint })
    } catch (error) {
      console.error(
        'Error downloading final supply equipment information:',
        error
      )
    } finally {
      setIsDownloading(false)
    }
  }

  const openFileImportDialog = (isOverwrite) => {
    setIsImportDialogOpen(true)
    setIsOverwrite(isOverwrite)
    importResultAppliedRef.current = false
    lastImportSummaryRef.current = null
  }

  const loadImportedChargingSites = useCallback(
    async (jobSummary = null) => {
      if (jobSummary) {
        lastImportSummaryRef.current = jobSummary
      } else if (lastImportSummaryRef.current) {
        jobSummary = lastImportSummaryRef.current
      }

      const isGovernmentUser = hasRoles?.('Government')
      const createdCount = jobSummary?.created ?? null

      if (!isGovernmentUser && !organizationId) {
        return
      }

      if (createdCount === 0) {
        alertRef.current?.triggerAlert({
          message: t('chargingSite:importNoRows', {
            defaultValue: 'No charging sites were imported.'
          }),
          severity: 'info'
        })
        setRowData([
          {
            id: uuid(),
            chargingSiteId: null,
            organizationId,
            validationStatus: 'error',
            modified: true
          }
        ])
        setErrors({})
        setWarnings({})
        importResultAppliedRef.current = true
        return
      }

      if (!createdCount) {
        return
      }

      try {
        const paginationPayload = {
          page: 1,
          size: createdCount,
          sortOrders: [
            {
              field: 'createDate',
              direction: 'desc'
            }
          ],
          filters: []
        }

        if (organizationId) {
          paginationPayload.filters.push({
            field: 'organizationId',
            filterType: 'number',
            type: 'equals',
            filter: organizationId
          })
        }

        const endpoint = isGovernmentUser
          ? apiRoutes.getAllChargingSites
          : apiRoutes.getAllChargingSitesByOrg.replace(':orgID', organizationId)

        const response = await apiService.post(endpoint, paginationPayload)
        const payload = response?.data ?? response
        const sites = payload?.chargingSites || []

        const limitedSites = sites.slice(0, createdCount).reverse()

        const formattedRows = limitedSites.map((site) => ({
          ...site,
          id: uuid(),
          organizationId: site.organizationId ?? organizationId,
          currentStatus: site.status?.status || site.currentStatus || 'Draft',
          validationStatus: 'valid',
          modified: false
        }))

        if (!isGovernmentUser) {
          formattedRows.push({
            id: uuid(),
            chargingSiteId: null,
            organizationId,
            validationStatus: 'error',
            modified: true
          })
        }

        setRowData(formattedRows)
        setErrors({})
        setWarnings({})
        importResultAppliedRef.current = true

        setTimeout(() => {
          gridRef.current?.api?.sizeColumnsToFit()
        }, 0)

        alertRef.current?.triggerAlert({
          message: t('chargingSite:importSuccess', {
            defaultValue: 'Charging sites have been refreshed.'
          }),
          severity: 'success'
        })
      } catch (error) {
        console.error('Error loading charging sites after import:', error)
        alertRef.current?.triggerAlert({
          message: t('chargingSite:importRefreshError', {
            defaultValue: 'Unable to refresh charging site data after import.'
          }),
          severity: 'error'
        })
      }
    },
    [apiService, organizationId, hasRoles, t, gridRef, setErrors, setWarnings]
  )

  const handleImportComplete = () => {
    // Refresh the current data if in edit mode
    if (isEditMode && refetch) {
      refetch()
    } else if (
      !isEditMode &&
      !importResultAppliedRef.current &&
      lastImportSummaryRef.current
    ) {
      loadImportedChargingSites(lastImportSummaryRef.current)
    }
    // Close the dialog
    setIsImportDialogOpen(false)
  }

  const handleNavigateBack = useCallback(() => {
    if (isEditMode) {
      setIsEditMode?.(false)
      refetch?.()
      return
    }

    navigate(ROUTES.REPORTS.CHARGING_SITE.INDEX)
  }, [isEditMode, navigate, refetch, setIsEditMode])

  const onAddRows = useCallback(
    (numRows) => {
      return Array(numRows)
        .fill()
        .map(() => ({
          id: uuid(),
          organizationId,
          validationStatus: 'error',
          modified: true
        }))
    },
    [organizationId]
  )

  return (
    <Grid2 className="add-edit-charging-site-container">
      <div className="header">
        <BCTypography variant="h5" color="primary">
          {isEditMode ? data.siteName : t('chargingSite:addNewSite')}
        </BCTypography>
        {!isEditMode && (
          <BCBox my={2.5} component="div">
            <BCTypography variant="body4" color="text" mt={0.5} component="div">
              {t('chargingSite:templateDescriptor')}
            </BCTypography>
          </BCBox>
        )}
      </div>
      {isFeatureEnabled(FEATURE_FLAGS.FSE_IMPORT_EXPORT) && !isEditMode && (
        <BCBox>
          <BCButton
            color="primary"
            variant="outlined"
            startIcon={<FontAwesomeIcon icon={faDownload} />}
            onClick={handleDownload}
            isLoading={isDownloading}
          >
            {t('common:importExport.export.btn')}
          </BCButton>
          <BCButton
            style={{ marginLeft: '12px' }}
            color="primary"
            variant="outlined"
            startIcon={<FontAwesomeIcon icon={faUpload} />}
            onClick={() => {
              openFileImportDialog(false)
            }}
          >
            {t('chargingSite:importBtn')}
          </BCButton>
        </BCBox>
      )}
      <BCBox my={2} component="div" style={{ height: '100%', width: '100%' }}>
        <BCGridEditor
          gridRef={gridRef}
          alertRef={alertRef}
          stopEditingWhenCellsLoseFocus
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          rowData={rowData}
          onAddRows={onAddRows}
          gridOptions={gridOptions}
          onCellEditingStopped={onCellEditingStopped}
          onAction={onAction}
          onFirstDataRendered={onFirstDataRendered}
          showAddRowsButton={!isEditMode}
          saveButtonProps={{
            enabled: true,
            text: t('common:saveReturnBtn'),
            onSave: handleNavigateBack,
            confirmText: t('chargingSite:incompleteSite'),
            confirmLabel: t('chargingSite:returnToSite')
          }}
        />
      </BCBox>
      <ImportDialog
        open={isImportDialogOpen}
        close={handleImportComplete}
        complianceReportId={organizationId}
        isOverwrite={isOverwrite}
        importHook={useImportChargingSites}
        getJobStatusHook={useGetChargingSitesImportJobStatus}
        onComplete={loadImportedChargingSites}
      />
    </Grid2>
  )
}
