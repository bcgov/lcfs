import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BCTypography from '@/components/BCTypography'
import Grid2 from '@mui/material/Grid2'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import { defaultColDef, finalSupplyEquipmentColDefs } from './_schema'
import {
  useFinalSupplyEquipmentOptions,
  useGetFinalSupplyEquipments,
  useSaveFinalSupplyEquipment,
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

export const AddEditFinalSupplyEquipments = () => {
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
  const apiService = useApiService()

  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'finalSupplyEquipment', 'reports'])
  const guides = t('finalSupplyEquipment:reportingResponsibilityInfo', {
    returnObjects: true
  })

  const { complianceReportId, compliancePeriod } = useParams()
  const navigate = useNavigate()

  const { data: currentReport, isLoading } =
    useComplianceReportWithCache(complianceReportId)

  const {
    data: optionsData,
    isLoading: optionsLoading,
    isFetched
  } = useFinalSupplyEquipmentOptions()

  const version = currentReport?.report?.version ?? 0
  const isOriginalReport = version === 0

  const { mutateAsync: saveRow } =
    useSaveFinalSupplyEquipment(complianceReportId)
  const {
    data,
    isLoading: equipmentsLoading,
    refetch
  } = useGetFinalSupplyEquipments(complianceReportId)

  // Decide when to hide or show Overwrite based on isOriginalReport + existing data
  useEffect(() => {
    const hasData = data?.finalSupplyEquipments?.length > 0
    if (!isOriginalReport && hasData) {
      setHideOverwrite(true)
    } else {
      setHideOverwrite(false)
    }
  }, [data, isOriginalReport])

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t(
        'finalSupplyEquipment:noFinalSupplyEquipmentsFound'
      ),
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
      if (isArrayEmpty(data)) {
        setRowData([
          {
            id: uuid(),
            complianceReportId,
            supplyFromDate: `${compliancePeriod}-01-01`,
            supplyToDate: `${compliancePeriod}-12-31`
          }
        ])
      } else {
        setRowData([
          ...data.finalSupplyEquipments.map((item) => ({
            ...item,
            id: uuid()
          })),
          {
            id: uuid(),
            complianceReportId,
            supplyFromDate: `${compliancePeriod}-01-01`,
            supplyToDate: `${compliancePeriod}-12-31`
          }
        ])
      }
      gridRef.current.api.sizeColumnsToFit()

      setTimeout(() => {
        const lastRowIndex = gridRef.current.api.getLastDisplayedRowIndex()
        gridRef.current.api.startEditingCell({
          rowIndex: lastRowIndex,
          colKey: 'organizationName'
        })
      }, 100)
    }
  }, [compliancePeriod, complianceReportId, data, isGridReady, gridRef])

  useEffect(() => {
    if (optionsData?.levelsOfEquipment?.length > 0) {
      const updatedColumnDefs = finalSupplyEquipmentColDefs(
        optionsData,
        compliancePeriod,
        errors,
        warnings,
        isGridReady
      )
      setColumnDefs(updatedColumnDefs)
    }
  }, [compliancePeriod, errors, warnings, optionsData, isGridReady])

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
      const updatedData = Object.entries(params.node.data)
        .filter(([, value]) => value !== null && value !== '')
        .reduce((acc, [key, value]) => {
          acc[key] = value
          return acc
        }, {})

      const responseData = await handleScheduleSave({
        alertRef,
        idField: 'finalSupplyEquipmentId',
        labelPrefix: 'finalSupplyEquipment:finalSupplyEquipmentColLabels',
        params,
        setErrors,
        setWarnings,
        saveRow,
        t,
        updatedData
      })

      alertRef.current?.clearAlert()
      params.node.updateData(responseData)
    },
    [saveRow, t]
  )

  const onAction = async (action, params) => {
    if (action === 'delete') {
      await handleScheduleDelete(
        params,
        'finalSupplyEquipmentId',
        saveRow,
        alertRef,
        setRowData,
        {
          complianceReportId,
          supplyFromDate: `${compliancePeriod}-01-01`,
          supplyToDate: `${compliancePeriod}-12-31`
        }
      )
    }
    if (action === 'duplicate') {
      const newRowID = uuid()
      const rowData = {
        ...params.node.data,
        id: newRowID,
        kwhUsage: null,
        serialNbr: null,
        latitude: null,
        longitude: null,
        finalSupplyEquipmentId: null,
        finalSupplyEquipment: null,
        validationStatus: 'error',
        modified: true
      }

      const transaction = {
        add: [rowData],
        addIndex: params.node?.rowIndex + 1
      }

      setErrors({ [newRowID]: 'finalSupplyEquipment' })

      alertRef.current?.triggerAlert({
        message: 'Unable to save row: Fuel supply equipment fields required',
        severity: 'error'
      })
      return transaction
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

  const handleNavigateBack = useCallback(() => {
    navigate(
      buildPath(ROUTES.REPORTS.VIEW, {
        compliancePeriod,
        complianceReportId
      }),
      {
        state: {
          expandedSchedule: 'finalSupplyEquipments',
          message: t('finalSupplyEquipment:scheduleUpdated'),
          severity: 'success'
        }
      }
    )
  }, [navigate, compliancePeriod, complianceReportId, t])

  const onAddRows = useCallback(
    (numRows) => {
      return Array(numRows)
        .fill()
        .map(() => ({
          id: uuid(),
          complianceReportId,
          supplyFromDate: `${compliancePeriod}-01-01`,
          supplyToDate: `${compliancePeriod}-12-31`,
          validationStatus: 'error',
          modified: true
        }))
    },
    [compliancePeriod, complianceReportId]
  )

  const [downloadAnchorEl, setDownloadAnchorEl] = useState(null)
  const [importAnchorEl, setImportAnchorEl] = useState(null)
  const isDownloadOpen = Boolean(downloadAnchorEl)
  const isImportOpen = Boolean(importAnchorEl)
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
    !equipmentsLoading &&
    !isLoading && (
      <Grid2 className="add-edit-final-supply-equipment-container" mx={-1}>
        <div className="header">
          <BCTypography variant="h5" color="primary">
            {t('finalSupplyEquipment:fseTitle')}
          </BCTypography>
          <BCBox my={2.5} component="div">
            {guides.map((v, i) => (
              <BCTypography
                key={i}
                variant="body4"
                color="text"
                mt={0.5}
                component="div"
                dangerouslySetInnerHTML={{ __html: v }}
              />
            ))}
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
            loading={optionsLoading || equipmentsLoading}
            onCellEditingStopped={onCellEditingStopped}
            onAction={onAction}
            showAddRowsButton={true}
            saveButtonProps={{
              enabled: true,
              text: t('report:saveReturn'),
              onSave: handleNavigateBack,
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
