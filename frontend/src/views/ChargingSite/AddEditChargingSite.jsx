import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BCTypography from '@/components/BCTypography'
import Grid2 from '@mui/material/Grid2'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import { defaultColDef, chargingSiteColDefs } from './_schema'
import {
  useImportFinalSupplyEquipment,
  useGetFinalSupplyEquipmentImportJobStatus
} from '@/hooks/useFinalSupplyEquipment'
import { v4 as uuid } from 'uuid'
import { ROUTES, buildPath } from '@/routes/routes'
import { handleScheduleDelete, handleScheduleSave } from '@/utils/schedules'
import { isArrayEmpty } from '@/utils/array'
import { useApiService } from '@/services/useApiService'
import { apiRoutes } from '@/constants/routes/index'
import BCButton from '@/components/BCButton/index.jsx'
import { Menu, MenuItem } from '@mui/material'
import { faCaretDown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ImportDialog from '@/components/ImportDialog'

import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config'
import { useComplianceReportWithCache } from '@/hooks/useComplianceReports'
import {
  getCurrentQuarter,
  getQuarterDateRange
} from '@/utils/dateQuarterUtils'
import {
  useChargingSiteMutation,
  useGetAllChargingSitesByOrg,
  useGetIntendedUsers
} from '@/hooks/useChargingSite'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export const AddEditChargingSite = () => {
  const [rowData, setRowData] = useState([])
  const gridRef = useRef(null)
  const [errors, setErrors] = useState({})
  const [warnings, setWarnings] = useState({})
  const [columnDefs, setColumnDefs] = useState([])
  const [isGridReady, setGridReady] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isOverwrite, setIsOverwrite] = useState(false)
  const [hideOverwrite, setHideOverwrite] = useState(false)
  const [downloadAnchorEl, setDownloadAnchorEl] = useState(null)
  const [importAnchorEl, setImportAnchorEl] = useState(null)
  const isDownloadOpen = Boolean(downloadAnchorEl)
  const isImportOpen = Boolean(importAnchorEl)
  const apiService = useApiService()

  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'finalSupplyEquipment', 'report'])

  const {
    data: currentUser,
    isLoading: isCurrentUserLoading,
    hasRoles,
    hasAnyRole
  } = useCurrentUser()

  const organizationId = useMemo(
    () => currentUser.organization?.organizationId,
    [currentUser]
  )
  const { complianceReportId = 62 } = useParams()
  const navigate = useNavigate()

  const {
    data: intendedUserTypes,
    isLoading: optionsLoading,
    isFetched
  } = useGetIntendedUsers()

  const { mutateAsync: saveRow } = useChargingSiteMutation(organizationId)
  const {
    data,
    isLoading: sitesLoading,
    refetch
  } = useGetAllChargingSitesByOrg(organizationId)

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('report:chargingSites.noSitesFound'),
      stopEditingWhenCellsLoseFocus: false,
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
    if (isGridReady && data) {
      const defaultOrgName = ''

      if (isArrayEmpty(data)) {
        setRowData([
          {
            id: uuid(),
            organizationId
          }
        ])
      } else {
        setRowData([
          ...data.chargingSites.map((item) => ({
            ...item,
            id: uuid()
          })),
          {
            id: uuid(),
            organizationId
          }
        ])
      }
      gridRef?.current?.api.sizeColumnsToFit()

      setTimeout(() => {
        const lastRowIndex = gridRef?.current?.api.getLastDisplayedRowIndex()
        gridRef?.current?.api.startEditingCell({
          rowIndex: lastRowIndex,
          colKey: 'siteName'
        })
      }, 100)
    }
  }, [data, isGridReady, gridRef, ''])

  useEffect(() => {
    if (
      !optionsLoading &&
      Array.isArray(intendedUserTypes) &&
      intendedUserTypes.length > 0
    ) {
      const updatedColumnDefs = chargingSiteColDefs(
        intendedUserTypes,
        errors,
        warnings,
        isGridReady
      )
      setColumnDefs(updatedColumnDefs)
    }
  }, [errors, warnings, intendedUserTypes, isGridReady])

  const onFirstDataRendered = useCallback((params) => {
    params.api.autoSizeAllColumns()
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

      // clean up any null or empty string values
      const updatedData = {
        ...Object.entries(params.node.data)
          .filter(
            ([, value]) => value !== null && value !== '' && value !== undefined
          )
          .reduce((acc, [key, value]) => {
            acc[key] = value
            return acc
          }, {}),
        status: 'Draft'
      }

      const responseData = await handleScheduleSave({
        alertRef,
        idField: 'chargingSiteId',
        labelPrefix: 'report:chargingSites.columnLabels',
        params,
        setErrors,
        setWarnings,
        saveRow,
        t,
        updatedData
      })

      alertRef.current?.clearAlert()
      params.node.updateData(responseData)
      params.api.autoSizeAllColumns()
    },
    [saveRow, t]
  )

  const onAction = async (action, params) => {
    if (action === 'delete') {
      const defaultOrgName = ''
      await handleScheduleDelete(
        params,
        'chargingSiteId',
        saveRow,
        alertRef,
        setRowData,
        {
          organizationId
        }
      )
    }
  }

  const handleDownload = async (includeData) => {
    try {
      handleCloseDownloadMenu()
      setIsDownloading(true)
      const endpoint = includeData
        ? apiRoutes.exportFinalSupplyEquipments.replace(
            ':reportID',
            complianceReportId
          )
        : apiRoutes.downloadFinalSupplyEquipmentsTemplate.replace(
            ':reportID',
            complianceReportId
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
    handleCloseDownloadMenu()
  }

  // const handleNavigateBack = useCallback(() => {
  //   navigate(
  //     buildPath(ROUTES.REPORTS.VIEW, {
  //       compliancePeriod,
  //       complianceReportId
  //     }),
  //     {
  //       state: {
  //         expandedSchedule: 'finalSupplyEquipments',
  //         message: t('finalSupplyEquipment:scheduleUpdated'),
  //         severity: 'success'
  //       }
  //     }
  //   )
  // }, [navigate, compliancePeriod, complianceReportId, t])

  const onAddRows = useCallback(
    (numRows) => {
      const defaultOrgName = ''
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
  const handleDownloadClick = (event) => {
    setDownloadAnchorEl(event.currentTarget)
  }
  const handleCloseDownloadMenu = () => {
    setDownloadAnchorEl(null)
  }
  const handleImportClick = (event) => {
    setImportAnchorEl(event.currentTarget)
  }
  const handleCloseImportMenu = () => {
    setImportAnchorEl(null)
  }

  return (
    isFetched &&
    !sitesLoading && (
      <Grid2 className="add-edit-charging-site-container" F>
        <div className="header">
          <BCTypography variant="h5" color="primary">
            {t('report:chargingSites.addNewSite')}
          </BCTypography>
          <BCBox my={2.5} component="div">
            <BCTypography variant="body4" color="text" mt={0.5} component="div">
              {t('report:chargingSites.templateDescriptor')}
            </BCTypography>
          </BCBox>
        </div>
        {isFeatureEnabled(FEATURE_FLAGS.FSE_IMPORT_EXPORT) && (
          <BCBox>
            <BCButton
              color="primary"
              variant="outlined"
              aria-controls={isDownloadOpen ? 'download-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={isDownloadOpen ? 'true' : undefined}
              onClick={handleDownloadClick}
              endIcon={<FontAwesomeIcon icon={faCaretDown} />}
              isLoading={isDownloading}
            >
              {t('common:importExport.export.btn')}
            </BCButton>
            <Menu
              id="download-menu"
              anchorEl={downloadAnchorEl}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right'
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right'
              }}
              open={isDownloadOpen}
              onClose={handleCloseDownloadMenu}
            >
              <MenuItem
                disabled={isDownloading}
                onClick={() => {
                  handleDownload(true)
                }}
              >
                {t('common:importExport.export.withDataBtn')}
              </MenuItem>
              <MenuItem
                disabled={isDownloading}
                onClick={() => {
                  handleDownload(false)
                }}
              >
                {t('common:importExport.export.withoutDataBtn')}
              </MenuItem>
            </Menu>
            <BCButton
              style={{ marginLeft: '12px' }}
              color="primary"
              variant="outlined"
              aria-controls={isImportOpen ? 'import-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={isImportOpen ? 'true' : undefined}
              onClick={handleImportClick}
              endIcon={<FontAwesomeIcon icon={faCaretDown} />}
            >
              {t('common:importExport.import.btn')}
            </BCButton>

            <Menu
              id="import-menu"
              slotProps={{
                paper: {
                  style: {
                    maxWidth: 240
                  }
                }
              }}
              anchorEl={importAnchorEl}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right'
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right'
              }}
              open={isImportOpen}
              onClose={handleCloseImportMenu}
            >
              {' '}
              {!hideOverwrite && (
                <MenuItem
                  onClick={() => {
                    openFileImportDialog(true)
                    handleCloseImportMenu()
                  }}
                >
                  {t('common:importExport.import.dialog.buttons.overwrite')}
                </MenuItem>
              )}
              <MenuItem
                onClick={() => {
                  openFileImportDialog(false)
                  handleCloseImportMenu()
                }}
              >
                {t('common:importExport.import.dialog.buttons.append')}
              </MenuItem>
            </Menu>
          </BCBox>
        )}
        <BCBox my={2} component="div" style={{ height: '100%', width: '100%' }}>
          <BCGridEditor
            gridRef={gridRef}
            alertRef={alertRef}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            rowData={rowData}
            onAddRows={onAddRows}
            gridOptions={gridOptions}
            loading={optionsLoading || sitesLoading}
            onCellEditingStopped={onCellEditingStopped}
            onAction={onAction}
            onFirstDataRendered={onFirstDataRendered}
            showAddRowsButton={true}
            saveButtonProps={{
              enabled: true,
              text: t('common:saveReturnBtn'),
              // onSave: handleNavigateBack,
              confirmText: t('report:incompleteReport'),
              confirmLabel: t('report:returnToReport')
            }}
          />
        </BCBox>
        <ImportDialog
          open={isImportDialogOpen}
          close={() => {
            setIsImportDialogOpen(false)
            refetch()
          }}
          complianceReportId={complianceReportId}
          isOverwrite={isOverwrite}
          importHook={useImportFinalSupplyEquipment}
          getJobStatusHook={useGetFinalSupplyEquipmentImportJobStatus}
        />
      </Grid2>
    )
  )
}
