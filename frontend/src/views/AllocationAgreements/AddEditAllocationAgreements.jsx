import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import BCTypography from '@/components/BCTypography'
import Grid2 from '@mui/material/Grid2'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import BCBox from '@/components/BCBox'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import {
  defaultColDef,
  allocationAgreementColDefs,
  PROVISION_APPROVED_FUEL_CODE
} from './_schema'
import {
  useAllocationAgreementOptions,
  useGetAllocationAgreementsList,
  useSaveAllocationAgreement,
  useImportAllocationAgreement,
  useGetAllocationAgreementImportJobStatus,
  useGetAllocationAgreementImportResult
} from '@/hooks/useAllocationAgreement'
import { useComplianceReportWithCache } from '@/hooks/useComplianceReports'
import { v4 as uuid } from 'uuid'
import { ROUTES, buildPath } from '@/routes/routes'
import { DEFAULT_CI_FUEL, REPORT_SCHEDULES } from '@/constants/common'
import { handleScheduleDelete, handleScheduleSave } from '@/utils/schedules'
import { useApiService } from '@/services/useApiService'
import { apiRoutes } from '@/constants/routes/apiRoutes'
import ImportDialog from '@/components/ImportDialog'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config'
import { Menu, MenuItem } from '@mui/material'
import BCButton from '@/components/BCButton'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCaretDown } from '@fortawesome/free-solid-svg-icons'

export const AddEditAllocationAgreements = () => {
  const [rowData, setRowData] = useState([])
  const [pendingRejectedRows, setPendingRejectedRows] = useState([])
  const gridRef = useRef(null)
  const [errors, setErrors] = useState({})
  const [warnings, setWarnings] = useState({})
  const [isDownloading, setIsDownloading] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isOverwrite, setIsOverwrite] = useState(false)
  const [hideOverwrite, setHideOverwrite] = useState(false)
  const [downloadAnchorEl, setDownloadAnchorEl] = useState(null)
  const [importAnchorEl, setImportAnchorEl] = useState(null)
  const isDownloadOpen = Boolean(downloadAnchorEl)
  const isImportOpen = Boolean(importAnchorEl)
  const apiService = useApiService()
  const [columnDefs, setColumnDefs] = useState([])
  const alertRef = useRef()
  const location = useLocation()
  const { t } = useTranslation(['common', 'allocationAgreement', 'reports'])
  const guides = useMemo(
    () =>
      t('allocationAgreement:allocationAgreementGuides', {
        returnObjects: true
      }),
    []
  )
  const params = useParams()
  const { complianceReportId, compliancePeriod } = params
  const navigate = useNavigate()
  const { data: currentReport, isLoading } =
    useComplianceReportWithCache(complianceReportId)

  const version = currentReport?.report?.version ?? 0
  const isOriginalReport = version === 0
  const isSupplemental = version !== 0
  const isEarlyIssuance =
    currentReport?.report?.reportingFrequency === REPORT_SCHEDULES.QUARTERLY

  const {
    data: optionsData,
    isLoading: optionsLoading,
    isFetched
  } = useAllocationAgreementOptions({ compliancePeriod })
  const { mutateAsync: saveRow } = useSaveAllocationAgreement({
    complianceReportId
  })
  // Note: importFile is not used directly anymore since ImportDialog
  // expects the hook itself, not the mutation function

  const {
    data,
    isLoading: allocationAgreementsLoading,
    refetch
  } = useGetAllocationAgreementsList({
    complianceReportId,
    changelog: isSupplemental
  })

  // Decide when to hide or show Overwrite based on isOriginalReport + existing data
  useEffect(() => {
    const hasData = data?.allocationAgreements?.length > 0
    if (!isOriginalReport && hasData) {
      setHideOverwrite(true)
    } else {
      setHideOverwrite(false)
    }
  }, [data, isOriginalReport])

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t(
        'allocationAgreement:noAllocationAgreementsFound'
      ),
      autoSizeStrategy: {
        type: 'fitCellContents',
        defaultMinWidth: 50,
        defaultMaxWidth: 600
      }
    }),
    [t, isSupplemental]
  )

  useEffect(() => {
    if (location.state?.message) {
      alertRef.current?.triggerAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
    }
  }, [location.state?.message, location.state?.severity])

  const validate = (
    params,
    validationFn,
    errorMessage,
    alertRef,
    field = null
  ) => {
    const value = field ? params.node?.data[field] : params

    if (field && params.colDef.field !== field) {
      return true
    }

    if (!validationFn(value)) {
      alertRef.current?.triggerAlert({
        message: errorMessage,
        severity: 'error'
      })
      return false
    }
    return true // Proceed with the update
  }

  const onGridReady = useCallback(
    async (params) => {
      if (
        Array.isArray(data.allocationAgreements) &&
        data.allocationAgreements.length > 0
      ) {
        const updatedRowData = data.allocationAgreements.map((item) => ({
          ...item,
          complianceReportId,
          compliancePeriod,
          isNewSupplementalEntry:
            isSupplemental && item.complianceReportId === +complianceReportId,
          id: item.id || uuid() // Ensure every item has a unique ID
        }))
        setRowData([...updatedRowData, { id: uuid() }])
      } else {
        setRowData([{ id: uuid(), complianceReportId, compliancePeriod }])
      }

      params.api.sizeColumnsToFit()

      setTimeout(() => {
        const lastRowIndex = params.api.getLastDisplayedRowIndex()
        params.api.setFocusedCell(lastRowIndex, 'allocationTransactionType')
        params.api.startEditingCell({
          rowIndex: lastRowIndex,
          colKey: 'allocationTransactionType'
        })
      }, 100)
    },
    [data, complianceReportId, compliancePeriod, isSupplemental]
  )

  useEffect(() => {
    const orgName = currentReport?.report?.organization?.name
    const updatedColumnDefs = allocationAgreementColDefs(
      optionsData,
      orgName,
      errors,
      warnings,
      isSupplemental,
      compliancePeriod,
      isEarlyIssuance
    )
    setColumnDefs(updatedColumnDefs)
  }, [
    optionsData,
    currentReport,
    errors,
    warnings,
    isSupplemental,
    compliancePeriod,
    isEarlyIssuance
  ])

  useEffect(() => {
    if (
      !allocationAgreementsLoading &&
      data?.allocationAgreements?.length > 0
    ) {
      const updatedRowData = data.allocationAgreements.map((item) => {
        let matchingRow = rowData.find(
          (row) => row.allocationAgreementId === item.allocationAgreementId
        )
        if (!matchingRow) {
          matchingRow = rowData.find(
            (row) =>
              row.allocationAgreementId === undefined ||
              row.allocationAgreementId === null
          )
        }
        return {
          ...item,
          complianceReportId,
          compliancePeriod,
          isNewSupplementalEntry:
            isSupplemental && item.complianceReportId === +complianceReportId,
          id: matchingRow ? matchingRow.id : uuid()
        }
      })
      // Merge with pending rejected rows
      // The pendingRejectedRows state is managed separately and cleared when a row is saved
      const allRows = [
        ...updatedRowData,
        ...pendingRejectedRows,
        { id: uuid(), complianceReportId, compliancePeriod }
      ]
      console.log('Setting rowData with rejected rows merged:', allRows)
      console.log('Pending rejected rows:', pendingRejectedRows.length)
      setRowData(allRows)
    } else {
      // Even if no data from server, include pending rejected rows
      const allRows = [
        ...pendingRejectedRows,
        { id: uuid(), complianceReportId, compliancePeriod }
      ]
      console.log('Setting rowData with only rejected rows:', allRows)
      setRowData(allRows)
    }
  }, [
    data,
    allocationAgreementsLoading,
    isSupplemental,
    complianceReportId,
    compliancePeriod,
    pendingRejectedRows
  ])

  const onFirstDataRendered = useCallback((params) => {
    params.api.autoSizeAllColumns()
  }, [])

  const onCellValueChanged = useCallback(
    async (params) => {
      setWarnings({}) // Reset warnings

      // If this is a rejected row being edited, clear its validation status
      if (params.data.isRejected) {
        params.node.setDataValue('validationStatus', 'pending')
        params.node.setDataValue('validationErrors', null)
        params.node.setDataValue('validationMsg', null)

        // Mark row as modified so it can be re-validated on save
        params.node.setDataValue('modified', true)
      }

      if (params.colDef.field === 'provisionOfTheAct') {
        params.node.setDataValue('fuelCode', '') // Reset fuelCode if provisionOfTheAct changes
      }

      if (
        ['fuelType', 'fuelCode', 'provisionOfTheAct'].includes(
          params.colDef.field
        )
      ) {
        let ciOfFuel = 0

        const selectedFuelType = optionsData?.fuelTypes?.find(
          (obj) => params.data.fuelType === obj.fuelType
        )

        if (params.colDef.field === 'fuelType') {
          if (selectedFuelType) {
            // Reset and set dependent fields for fuelType
            const fuelCategoryOptions = selectedFuelType.fuelCategories.map(
              (item) => item.fuelCategory
            )

            // Set to null if multiple options, otherwise use the first item
            const categoryValue =
              fuelCategoryOptions.length === 1 ? fuelCategoryOptions[0] : null

            params.node.setDataValue('fuelCategory', categoryValue)

            // Reset provisionOfTheAct and provisionOfTheActId fields
            if (selectedFuelType.provisions.length === 1) {
              params.node.setDataValue(
                'provisionOfTheAct',
                selectedFuelType.provisions[0].name
              )
              params.node.setDataValue(
                'provisionOfTheActId',
                selectedFuelType.provisions[0].provisionOfTheActId
              )
            } else {
              params.node.setDataValue('provisionOfTheAct', null)
              params.node.setDataValue('provisionOfTheActId', null)
            }
          } else {
            // Reset all related fields if no valid fuelType is selected
            params.node.setDataValue('fuelCategory', null)
            params.node.setDataValue('provisionOfTheAct', null)
            params.node.setDataValue('provisionOfTheActId', null)
          }
        }

        if (params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE) {
          // Logic for approved fuel code provision
          const fuelCode = selectedFuelType?.fuelCodes?.find(
            (item) => item.fuelCode === params.data.fuelCode
          )
          ciOfFuel = fuelCode?.fuelCodeCarbonIntensity || 0
        } else {
          // Default carbon intensity for fuel type
          ciOfFuel = selectedFuelType?.defaultCarbonIntensity || 0
        }

        // Set the carbon intensity value
        params.node.setDataValue('ciOfFuel', ciOfFuel)
      }

      if (params.colDef.field === 'fuelCategory') {
        const selectedFuelType = optionsData?.fuelTypes?.find(
          (obj) => params.node.data.fuelType === obj.fuelType
        )

        if (selectedFuelType) {
          const validFuelCategory = selectedFuelType.fuelCategories.find(
            (item) => item.fuelCategory === params.data.fuelCategory
          )

          // Reset fuelCategory if the selected one is invalid
          if (!validFuelCategory) {
            params.node.setDataValue('fuelCategory', null)
          }
        }
      }
    },
    [optionsData]
  )

  const onCellEditingStopped = useCallback(
    async (params) => {
      if (params.oldValue === params.newValue) return

      // User cannot select their own organization as the transaction partner
      if (params.colDef.field === 'transactionPartner') {
        const orgName = currentReport?.report?.organization?.name
        if (
          params.newValue === orgName ||
          (typeof params.newValue === 'object' &&
            params.newValue.name === orgName)
        ) {
          alertRef.current?.triggerAlert({
            message:
              'You cannot select your own organization as the transaction partner.',
            severity: 'error'
          })
          params.node.setDataValue('transactionPartner', '')
          return
        }
        params.node.setDataValue(
          'transactionPartner',
          typeof params.newValue === 'string'
            ? params.newValue
            : params.newValue?.name
        )
      }

      const isValid = validate(
        params,
        (value) => {
          return value !== null && !isNaN(value) && value > 0
        },
        'Quantity supplied must be greater than 0.',
        alertRef,
        'quantity'
      )

      if (!isValid) {
        return
      }

      params.node.updateData({
        ...params.node.data,
        validationStatus: 'pending'
      })

      alertRef.current?.triggerAlert({
        message: 'Updating row...',
        severity: 'pending'
      })

      let updatedData = Object.entries(params.node.data)
        .filter(([, value]) => value !== null && value !== '')
        .reduce((acc, [key, value]) => {
          acc[key] = value
          return acc
        }, {})

      if (updatedData.fuelType === 'Other') {
        updatedData.ciOfFuel = DEFAULT_CI_FUEL[updatedData.fuelCategory]
      }

      // Clear temporary rejected row flags before saving
      if (updatedData.isRejected) {
        delete updatedData.isRejected
        delete updatedData.validationErrors
        delete updatedData.validationMsg
        delete updatedData.rowNumber
        // Remove temporary ID for rejected rows
        if (
          !updatedData.allocationAgreementId ||
          updatedData.allocationAgreementId === null
        ) {
          delete updatedData.allocationAgreementId
        }
      }

      const wasRejected = params.node.data.isRejected
      const originalId = params.node.data.id

      updatedData = await handleScheduleSave({
        alertRef,
        idField: 'allocationAgreementId',
        labelPrefix: 'allocationAgreement:allocationAgreementColLabels',
        params,
        setErrors,
        setWarnings,
        saveRow,
        t,
        updatedData
      })

      updatedData.ciOfFuel = params.node.data.ciOfFuel

      // If this was a rejected row that's now saved successfully
      if (
        wasRejected &&
        updatedData.allocationAgreementId &&
        updatedData.validationStatus === 'success'
      ) {
        console.log(
          'Successfully saved rejected row, removing from pendingRejectedRows',
          originalId
        )
        // Remove from pendingRejectedRows
        setPendingRejectedRows((prev) => {
          const filtered = prev.filter((row) => row.id !== originalId)
          console.log('Filtered pendingRejectedRows:', filtered)
          return filtered
        })

        // Remove the rejected row from the grid immediately
        const rowNode = params.api.getRowNode(originalId)
        if (rowNode) {
          const transaction = {
            remove: [rowNode.data]
          }
          params.api.applyTransaction(transaction)
          console.log('Removed rejected row from grid')
        }

        // Trigger a refetch to get the properly saved data from server
        setTimeout(() => {
          refetch()
        }, 500)
      } else {
        // Only update the row if it wasn't a successfully saved rejected row
        params.node.updateData(updatedData)
      }

      params.api.autoSizeAllColumns()
    },
    [saveRow, t, refetch]
  )

  const onAction = async (action, params) => {
    if (action === 'delete' || action === 'undo') {
      await handleScheduleDelete(
        params,
        'allocationAgreementId',
        saveRow,
        alertRef,
        setRowData,
        {
          complianceReportId,
          compliancePeriod
        }
      )
    }
  }

  const handleDownload = async (includeData) => {
    try {
      handleCloseDownloadMenu()
      setIsDownloading(true)

      const url = includeData
        ? apiRoutes.exportAllocationAgreements.replace(
            ':reportID',
            complianceReportId
          )
        : apiRoutes.downloadAllocationAgreementsTemplate.replace(
            ':reportID',
            complianceReportId
          )

      await apiService.download({ url })
    } catch (error) {
      console.error(
        'Error downloading allocation agreement information:',
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

  const handleImportRejectedRows = useCallback(
    (rejectedRows) => {
      console.log('handleImportRejectedRows called with:', rejectedRows)

      // Transform rejected rows into the format expected by the AG Grid
      const formattedRejectedRows = rejectedRows.map((rejectedRow, index) => {
        const { data, errors, row_number } = rejectedRow
        console.log('Processing rejected row:', rejectedRow)

        // Map backend field names to frontend field names
        // Backend uses the _row_to_dict mapping from importer.py
        const mappedRow = {
          id: `rejected-${Date.now()}-${index}`, // Temporary ID for rejected rows
          allocationAgreementId: null, // No backend ID yet for rejected rows
          complianceReportId: complianceReportId,
          allocationTransactionType: data.allocationTransactionType || 'Sold', // Default to 'Sold'
          transactionPartner: data.transactionPartner || '',
          postalAddress: data.postalAddress || '',
          transactionPartnerEmail: data.transactionPartnerEmail || '',
          transactionPartnerPhone: data.transactionPartnerPhone || '',
          fuelType: data.fuelType || '',
          fuelTypeOther: data.fuelTypeOther || '',
          fuelCategory: data.fuelCategory || '',
          provisionOfTheAct: data.provisionOfTheAct || '',
          fuelCode: data.fuelCode || '',
          ciOfFuel: '', // This will be calculated from fuelCode
          quantity: data.quantity || 0,
          units: 'L', // Default units
          // These IDs will be resolved by AG Grid's autocomplete editors
          fuelTypeId: null,
          fuelCategoryId: null,
          provisionOfTheActId: null,
          fuelCodeId: null,
          // Add validation metadata
          validationStatus: 'error',
          validationErrors: errors,
          validationMsg: errors.map((e) => e.message).join('; '),
          isRejected: true,
          rowNumber: row_number
        }

        return mappedRow
      })

      // Store rejected rows separately to prevent them from being lost on refetch
      console.log('Storing formatted rejected rows:', formattedRejectedRows)
      setPendingRejectedRows(formattedRejectedRows)
    },
    [complianceReportId]
  )

  const handleNavigateBack = useCallback(() => {
    navigate(
      buildPath(ROUTES.REPORTS.VIEW, { compliancePeriod, complianceReportId }),
      {
        state: {
          expandedSchedule: 'allocationAgreements',
          message: t('allocationAgreement:scheduleUpdated'),
          severity: 'success'
        }
      }
    )
  }, [navigate, compliancePeriod, complianceReportId, t])

  return (
    isFetched &&
    !allocationAgreementsLoading &&
    !isLoading && (
      <Grid2 className="add-edit-allocation-agreement-container" mx={-1}>
        <div className="header">
          <BCTypography variant="h5" color="primary">
            {t('allocationAgreement:allocationAgreementTitle')}
          </BCTypography>
          <BCBox my={2}>
            {guides.map((v, i) => (
              <BCTypography
                key={i}
                variant="body4"
                color="text"
                my={0.5}
                component="div"
              >
                {v}
              </BCTypography>
            ))}
          </BCBox>
        </div>
        {isFeatureEnabled(FEATURE_FLAGS.ALLOCATION_AGREEMENT_IMPORT_EXPORT) &&
          !isEarlyIssuance && (
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
            gridOptions={gridOptions}
            loading={optionsLoading || allocationAgreementsLoading}
            loadingMessage={'Loading...'}
            onCellValueChanged={onCellValueChanged}
            onCellEditingStopped={onCellEditingStopped}
            onAction={onAction}
            stopEditingWhenCellsLoseFocus
            onFirstDataRendered={onFirstDataRendered}
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
            refetch() // Refresh the data after import completion
          }}
          complianceReportId={complianceReportId}
          isOverwrite={isOverwrite}
          importHook={useImportAllocationAgreement}
          getJobStatusHook={useGetAllocationAgreementImportJobStatus}
          onImportComplete={(rejectedRows) => {
            handleImportRejectedRows(rejectedRows)
          }}
        />
      </Grid2>
    )
  )
}
