import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Stack } from '@mui/material'
import Grid2 from '@mui/material/Grid2'
import { v4 as uuid } from 'uuid'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import Loading from '@/components/Loading'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/routes/routes'
import {
  useFuelCodeMutation,
  useFuelCodeOptions,
  useGetFuelCode
} from '@/hooks/useFuelCode'
import withRole from '@/utils/withRole'
import { defaultColDef, fuelCodeColDefs } from './_schema'
import { useNavigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import { FUEL_CODE_STATUSES } from '@/constants/statuses'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import Papa from 'papaparse'
import {
  fuelCodeButtonConfigFn,
  buildFuelCodeButtonContext
} from './buttonConfigs'

const NON_EDITABLE_STATUSES = [
  FUEL_CODE_STATUSES.APPROVED,
  FUEL_CODE_STATUSES.RECOMMENDED
]
const DEFAULT_PREFIX = 'BCLCF'

const transformExistingFuelCodeData = (existingFuelCode) => ({
  ...existingFuelCode,
  feedstockFuelTransportMode: existingFuelCode.feedstockFuelTransportModes.map(
    (mode) => mode.feedstockFuelTransportMode.transportMode
  ),
  finishedFuelTransportMode: existingFuelCode.finishedFuelTransportModes.map(
    (mode) => mode.finishedFuelTransportMode.transportMode
  )
})

const createDefaultRow = (optionsData) => {
  const defaultPrefix = optionsData?.fuelCodePrefixes?.find(
    (item) => item.prefix === DEFAULT_PREFIX
  )
  return {
    id: uuid(),
    prefixId: defaultPrefix?.fuelCodePrefixId || 1,
    prefix: defaultPrefix?.prefix || DEFAULT_PREFIX,
    fuelSuffix: defaultPrefix?.nextFuelCode
  }
}

const filterNonNullValues = (data) =>
  Object.entries(data)
    .filter(([, value]) => value !== null && value !== '')
    .reduce((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {})

const AddEditFuelCodeBase = () => {
  const { fuelCodeID } = useParams()
  const gridRef = useRef(null)
  const alertRef = useRef()
  const { t } = useTranslation(['common', 'fuelCode'])
  const navigate = useNavigate()

  // State
  const [rowData, setRowData] = useState([])
  const [errors, setErrors] = useState({})
  const [columnDefs, setColumnDefs] = useState([])
  const [isGridReady, setGridReady] = useState(false)
  const [modalData, setModalData] = useState(null)
  const [initialized, setInitialized] = useState(false)
  const [isInEditMode, setIsInEditMode] = useState(false)
  const [originalStatus, setOriginalStatus] = useState(null)

  // Hooks
  const { hasRoles } = useCurrentUser()
  const {
    data: optionsData,
    isLoading,
    isFetched,
    refetch: refetchOptions
  } = useFuelCodeOptions()

  const fuelCodeMutation = useFuelCodeMutation()

  const {
    data: existingFuelCode,
    isLoading: isLoadingExistingCode,
    refetch
  } = useGetFuelCode(fuelCodeID)

  // Track original status when fuel code is first loaded
  useEffect(() => {
    if (existingFuelCode && originalStatus === null) {
      setOriginalStatus(existingFuelCode.fuelCodeStatus.status)
    }
  }, [existingFuelCode, originalStatus])

  const isEditable = useMemo(
    () =>
      !NON_EDITABLE_STATUSES.includes(existingFuelCode?.fuelCodeStatus.status),
    [existingFuelCode?.fuelCodeStatus.status]
  )

  const isAnalyst = useMemo(() => hasRoles(roles.analyst), [hasRoles])

  const transformedExistingData = useMemo(
    () =>
      existingFuelCode ? transformExistingFuelCodeData(existingFuelCode) : null,
    [existingFuelCode]
  )

  // Determine if we should show edit or save button
  const shouldShowEditButton = useMemo(() => {
    return !isInEditMode && existingFuelCode
  }, [isInEditMode, existingFuelCode])

  const shouldShowSaveButton = useMemo(() => {
    return isInEditMode || !existingFuelCode
  }, [isInEditMode, existingFuelCode])

  const titleText = useMemo(() => {
    if (!existingFuelCode) return t('fuelCode:newFuelCodeTitle')

    const status = existingFuelCode.fuelCodeStatus.status
    if (status === FUEL_CODE_STATUSES.DRAFT && isInEditMode)
      return t('fuelCode:editFuelCodeTitle')
    return t('fuelCode:viewFuelCodeTitle')
  }, [existingFuelCode, t, isInEditMode])

  const showGuideText = useMemo(
    () =>
      !existingFuelCode ||
      existingFuelCode.fuelCodeStatus.status === FUEL_CODE_STATUSES.DRAFT,
    [existingFuelCode]
  )

  // Check if notes are required (fuel code was returned from Recommended/Approved to Draft)
  const isNotesRequired = useMemo(() => {
    if (!existingFuelCode) return false

    const currentStatus = existingFuelCode.fuelCodeStatus.status

    return (
      currentStatus === FUEL_CODE_STATUSES.DRAFT &&
      existingFuelCode?.isNotesRequired
    )
  }, [existingFuelCode])

  // Validation for notes field
  const hasNotesValidationError = useMemo(() => {
    if (!isNotesRequired) return false

    const currentRow = rowData[0]
    return !currentRow?.notes || currentRow.notes.trim() === ''
  }, [isNotesRequired, rowData])

  // Initialize row data once when all dependencies are ready
  useEffect(() => {
    if (!initialized && isFetched && !isLoadingExistingCode && isGridReady) {
      if (transformedExistingData) {
        setRowData([transformedExistingData])
      } else {
        setRowData([createDefaultRow(optionsData)])
      }
      setInitialized(true)
    }
  }, [
    initialized,
    isFetched,
    isLoadingExistingCode,
    isGridReady,
    transformedExistingData,
    optionsData
  ])

  // Update column definitions when dependencies change
  useEffect(() => {
    if (optionsData) {
      const canEditGrid = isInEditMode || !existingFuelCode
      const updatedColumnDefs = fuelCodeColDefs(
        optionsData,
        errors,
        !existingFuelCode,
        canEditGrid,
        isNotesRequired,
        existingFuelCode?.canEditCi
      )
      setColumnDefs(updatedColumnDefs)
    }
  }, [
    errors,
    optionsData,
    existingFuelCode,
    isInEditMode,
    isAnalyst,
    isNotesRequired
  ])

  // Callbacks
  const onGridReady = useCallback((params) => {
    setGridReady(true)
    params.api.sizeColumnsToFit()
  }, [])

  const handleError = useCallback((_error, message, severity = 'error') => {
    alertRef.current?.triggerAlert({ message, severity })
  }, [])

  const onCellValueChanged = useCallback(
    async (params) => {
      const updatedData = { ...params.data, modified: true }

      if (params.colDef.field === 'prefix') {
        const nextFuelCode = optionsData?.fuelCodePrefixes?.find(
          (item) => item.prefix === params.newValue
        )?.nextFuelCode
        updatedData.fuelSuffix = nextFuelCode
      }

      params.api.applyTransaction({ update: [updatedData] })
    },
    [optionsData?.fuelCodePrefixes]
  )

  const handleSaveSuccess = useCallback(async () => {
    await refetch()
    setIsInEditMode(false)
    setModalData(null)
    navigate(ROUTES.FUEL_CODES.LIST, {
      state: {
        message: t(
          'fuelCode:saveSuccessMessage',
          'Fuel code saved successfully.'
        ),
        severity: 'success'
      }
    })
  }, [refetch, t])

  const handleDeleteFuelCode = useCallback(
    async (fuelCodeId, params) => {
      if (fuelCodeId) {
        try {
          await fuelCodeMutation.mutateAsync({ action: 'delete', fuelCodeId })
          alertRef.current?.triggerAlert({
            message: 'Row deleted successfully.',
            severity: 'success'
          })
        } catch (error) {
          handleError(error, `Error deleting row: ${error.message}`)
          return
        }
      }

      params.api.applyTransaction({ remove: [params.node.data] })
      setModalData(null)
    },
    [fuelCodeMutation, handleError]
  )

  const handleApproveCode = useCallback(
    async (fuelCodeId) => {
      try {
        await fuelCodeMutation.mutateAsync({
          action: 'approve',
          data: { status: FUEL_CODE_STATUSES.APPROVED },
          fuelCodeId
        })
        await refetch()
        setModalData(null)
        alertRef.current?.triggerAlert({
          message: t(
            'fuelCode:approveSuccessMessage',
            'Fuel code approved successfully.'
          ),
          severity: 'success'
        })
      } catch (error) {
        handleError(error, `Error approving fuel code: ${error.message}`)
      }
    },
    [fuelCodeMutation, refetch, t, handleError]
  )

  const openDeleteModal = useCallback(
    (fuelCodeId, params) => {
      setModalData({
        primaryButtonAction: () => handleDeleteFuelCode(fuelCodeId, params),
        primaryButtonText: t('fuelCode:deleteFuelCodeBtn'),
        secondaryButtonText: t('cancelBtn'),
        title: t('fuelCode:deleteFuelCode'),
        content: (
          <Stack>
            <BCTypography variant="h6">
              {t('fuelCode:deleteFuelCode')}
            </BCTypography>
            <BCTypography mt={1} variant="body5">
              {t('fuelCode:deleteConfirmText')}
            </BCTypography>
          </Stack>
        )
      })
    },
    [handleDeleteFuelCode, t]
  )

  const openApprovalModal = useCallback(
    (fuelCodeId) => {
      setModalData({
        primaryButtonAction: () => handleApproveCode(fuelCodeId),
        primaryButtonText: t('fuelCode:approveFuelCodeBtn'),
        secondaryButtonText: t('cancelBtn'),
        title: t('fuelCode:approveFuelCode'),
        content: (
          <Stack>
            <BCTypography variant="h6">
              {t('fuelCode:approveFuelCode')}
            </BCTypography>
            <BCTypography mt={1} variant="body5">
              {t('fuelCode:approveConfirmText')}
            </BCTypography>
          </Stack>
        )
      })
    },
    [handleApproveCode, t]
  )

  const updateRowWithValidation = useCallback(
    async (params, updatedData) => {
      try {
        setErrors({})

        const action =
          updatedData.validationStatus === 'pending'
            ? 'save'
            : updatedData.fuelCodeId
              ? 'update'
              : 'create'
        const result = await fuelCodeMutation.mutateAsync({
          action,
          data: updatedData,
          fuelCodeId: updatedData.fuelCodeId
        })

        if (action === 'create') {
          updatedData.fuelCodeId = result.data.fuelCodeId
          updatedData.fuelSuffix = result.data.fuelSuffix
        }

        const finalData = {
          ...updatedData,
          validationStatus: 'success',
          modified: false
        }

        alertRef.current?.triggerAlert({
          message: 'Row updated successfully.',
          severity: 'success'
        })

        return finalData
      } catch (error) {
        setErrors({
          [params.node.data.id]: error.response?.data?.errors?.[0]?.fields
        })

        const isNewRow = !updatedData.fuelCodeId
        const severity = isNewRow ? 'warning' : 'error'

        let errMsg = 'Unable to save row'
        if (error.response?.data?.errors?.[0]) {
          const { fields, message } = error.response.data.errors[0]
          const fieldLabels = fields?.map((field) =>
            t(`fuelCode:fuelCodeColLabels.${field}`)
          )
          errMsg = `Unable to save row: ${fieldLabels?.length === 1 ? fieldLabels[0] : ''} ${message}`
        } else {
          errMsg = `Unable to save row: ${error.response?.data?.detail || error.message}`
        }

        handleError(error, errMsg, severity)

        return {
          ...updatedData,
          validationStatus: severity,
          validationMsg: errMsg
        }
      }
    },
    [fuelCodeMutation, setErrors, t, handleError]
  )

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

      const filteredData = filterNonNullValues(params.node.data)
      const finalData = await updateRowWithValidation(params, filteredData)
      params.node.updateData(finalData)
    },
    [updateRowWithValidation]
  )

  const parsePastedData = useCallback((pastedData, headerRow) => {
    return Papa.parse(headerRow + '\n' + pastedData, {
      delimiter: '\t',
      header: true,
      transform: (value, field) => {
        // Handle date formatting
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/
        if (field.toLowerCase().includes('date') && !dateRegex.test(value)) {
          const parsedDate = new Date(value)
          if (!isNaN(parsedDate)) {
            return parsedDate.toISOString().split('T')[0]
          }
        }

        // Convert to number if possible
        const num = Number(value)
        return isNaN(num) ? value : num
      },
      skipEmptyLines: true
    })
  }, [])

  const handlePaste = useCallback(
    (event, { api }) => {
      const clipboardData = event.clipboardData || window.clipboardData
      const pastedData = clipboardData.getData('text/plain')

      const headerRow = api
        .getAllDisplayedColumns()
        .map((column) => column.colDef.field)
        .filter(Boolean)
        .join('\t')

      const parsedData = parsePastedData(pastedData, headerRow)

      if (!parsedData.data?.length) return

      const newData = parsedData.data.map((row) => {
        const newRow = { ...row }
        newRow.id = uuid()
        newRow.prefixId = optionsData?.fuelCodePrefixes?.find(
          (o) => o.prefix === row.prefix
        )?.fuelCodePrefixId
        newRow.fuelTypeId = optionsData?.fuelTypes?.find(
          (o) => o.fuelType === row.fuelType
        )?.fuelTypeId
        newRow.fuelSuffix = newRow.fuelSuffix?.toString()
        newRow.feedstockFuelTransportMode =
          row.feedstockFuelTransportMode
            ?.split(',')
            .map((item) => item.trim()) || []
        newRow.finishedFuelTransportMode =
          row.finishedFuelTransportMode
            ?.split(',')
            .map((item) => item.trim()) || []
        newRow.modified = true
        return newRow
      })

      const transactions = api.applyTransaction({ add: newData })

      // Trigger validation for new rows
      transactions.add.forEach((node) => {
        onCellEditingStopped({
          node,
          oldValue: '',
          newValue: undefined
        })
      })
    },
    [parsePastedData, onCellEditingStopped, optionsData]
  )

  const duplicateFuelCode = useCallback(
    async (params) => {
      const originalData = params.data
      const originalPrefix = originalData.prefix || DEFAULT_PREFIX

      try {
        const updatedOptions = await refetchOptions()
        const selectedPrefix = updatedOptions.data.fuelCodePrefixes?.find(
          (p) => p.prefix === originalPrefix
        )

        const newRow = {
          ...originalData,
          id: uuid(),
          fuelCodeId: null,
          modified: true,
          validationStatus: 'error',
          validationMsg: 'Fill in the missing fields'
        }

        if (selectedPrefix) {
          newRow.prefixId = selectedPrefix.fuelCodePrefixId
          newRow.prefix = selectedPrefix.prefix
          newRow.fuelSuffix = selectedPrefix.nextFuelCode
        }

        if (originalData.fuelCodeId) {
          const response = await fuelCodeMutation.mutateAsync({
            action: 'create',
            data: newRow
          })
          return {
            add: [
              {
                ...response.data,
                id: uuid(),
                modified: false,
                validationStatus: 'error'
              }
            ]
          }
        }

        return { add: [newRow] }
      } catch (error) {
        handleError(error, `Error duplicating row: ${error.message}`)
        return null
      }
    },
    [refetchOptions, fuelCodeMutation, handleError]
  )

  const handleOpenApprovalModal = useCallback(() => {
    openApprovalModal(fuelCodeID)
  }, [openApprovalModal, fuelCodeID])

  // Button configuration
  const buttonContext = useMemo(
    () =>
      buildFuelCodeButtonContext({
        fuelCode: existingFuelCode,
        hasRoles,
        t,
        setModalData,
        handleSave: async () => {
          try {
            if (hasNotesValidationError) {
              alertRef.current?.triggerAlert({
                message: t('fuelCode:notesRequiredMessage'),
                severity: 'error'
              })
              return
            }

            await handleSaveSuccess()
          } catch (error) {
            handleError(error, `Error saving fuel code: ${error.message}`)
          }
        },
        handleRecommend: async () => {
          try {
            await fuelCodeMutation.mutateAsync({
              action: 'update',
              data: { status: FUEL_CODE_STATUSES.RECOMMENDED },
              fuelCodeId: fuelCodeID
            })
            await refetch()
            setModalData(null)
            alertRef.current?.triggerAlert({
              message: t('fuelCode:recommendSuccessMessage'),
              severity: 'success'
            })
          } catch (error) {
            handleError(error, `Error recommending fuel code: ${error.message}`)
          }
        },
        handleApprove: async () => {
          try {
            await fuelCodeMutation.mutateAsync({
              action: 'update',
              data: { status: FUEL_CODE_STATUSES.APPROVED },
              fuelCodeId: fuelCodeID
            })
            await refetch()
            setModalData(null)
            alertRef.current?.triggerAlert({
              message: t('fuelCode:approveSuccessMessage'),
              severity: 'success'
            })
          } catch (error) {
            handleError(error, `Error approving fuel code: ${error.message}`)
          }
        },
        handleEdit: async () => {
          try {
            // Set original status before changing to draft if not already set
            if (originalStatus === null && existingFuelCode) {
              setOriginalStatus(existingFuelCode.fuelCodeStatus.status)
            }
            if (
              existingFuelCode.fuelCodeStatus.status !==
              FUEL_CODE_STATUSES.DRAFT
            ) {
              await fuelCodeMutation.mutateAsync({
                action: 'update',
                data: { status: FUEL_CODE_STATUSES.DRAFT },
                fuelCodeId: fuelCodeID
              })
              await refetch()
            }
            setIsInEditMode(true)
            setModalData(null)
            alertRef.current?.triggerAlert({
              message: t('fuelCode:editModeEnabledMessage'),
              severity: 'success'
            })
          } catch (error) {
            handleError(error, `Error enabling edit mode: ${error.message}`)
          }
        },
        handleDelete: async () => {
          try {
            if (fuelCodeID) {
              await fuelCodeMutation.mutateAsync({
                action: 'delete',
                fuelCodeId: fuelCodeID
              })
              setModalData(null)
              navigate(ROUTES.FUEL_CODES.LIST, {
                state: {
                  message: t('fuelCode:deleteSuccessMessage'),
                  severity: 'success'
                }
              })
            }
          } catch (error) {
            handleError(error, `Error deleting fuel code: ${error.message}`)
          }
        },
        handleReturnToAnalyst: async () => {
          try {
            // Set original status before changing to draft if not already set
            if (originalStatus === null && existingFuelCode) {
              setOriginalStatus(existingFuelCode.fuelCodeStatus.status)
            }

            await fuelCodeMutation.mutateAsync({
              action: 'update',
              data: { status: FUEL_CODE_STATUSES.DRAFT },
              fuelCodeId: fuelCodeID
            })
            await refetch()
            setModalData(null)
            alertRef.current?.triggerAlert({
              message: t('fuelCode:returnToAnalystSuccessMessage'),
              severity: 'success'
            })
          } catch (error) {
            handleError(error, `Error returning to analyst: ${error.message}`)
          }
        },
        hasChanges: rowData.some((row) => row.modified),
        hasValidationErrors:
          Object.keys(errors).length > 0 || hasNotesValidationError,
        isComplete: existingFuelCode ? true : false,
        canEdit: isEditable,
        canDelete:
          isEditable &&
          (!fuelCodeID ||
            existingFuelCode?.fuelCodeStatus.status ===
              FUEL_CODE_STATUSES.DRAFT),
        shouldShowEditButton,
        shouldShowSaveButton,
        isInEditMode
      }),
    [
      existingFuelCode,
      hasRoles,
      t,
      setModalData,
      handleOpenApprovalModal,
      fuelCodeMutation,
      fuelCodeID,
      rowData,
      errors,
      hasNotesValidationError,
      isEditable,
      shouldShowEditButton,
      shouldShowSaveButton,
      isInEditMode,
      originalStatus,
      updateRowWithValidation,
      filterNonNullValues,
      handleSaveSuccess,
      handleError,
      refetch
    ]
  )

  const buttonConfig = useMemo(() => {
    const config = fuelCodeButtonConfigFn(buttonContext)
    return config[buttonContext.currentStatus] || []
  }, [buttonContext])

  const onAction = useCallback(
    async (action, params) => {
      switch (action) {
        case 'duplicate':
          return await duplicateFuelCode(params)

        case 'delete':
          openDeleteModal(params.data.fuelCodeId, params)
          break

        case 'add': {
          const updatedOptions = await refetchOptions()
          const defaultPrefix = updatedOptions.data.fuelCodePrefixes.find(
            (item) => item.prefix === DEFAULT_PREFIX
          )

          return {
            add: [
              {
                id: uuid(),
                prefixId: defaultPrefix.fuelCodePrefixId,
                prefix: defaultPrefix.prefix,
                fuelSuffix: defaultPrefix.nextFuelCode,
                modified: true,
                validationStatus: 'error',
                validationMsg: 'Fill in missing fields'
              }
            ]
          }
        }

        default:
          return null
      }
    },
    [duplicateFuelCode, openDeleteModal, refetchOptions]
  )

  if (isLoading || isLoadingExistingCode) {
    return <Loading />
  }

  if (!isFetched) {
    return null
  }

  return (
    <>
      <Grid2 className="add-edit-fuel-code-container">
        <div className="header">
          <BCTypography variant="h5" color="primary">
            {titleText}
          </BCTypography>
          {showGuideText && (
            <BCTypography variant="body2" mt={2} mb={3}>
              {t('fuelCode:fuelCodeEntryGuide')}
            </BCTypography>
          )}
          {isNotesRequired && (
            <BCTypography variant="body2" mt={2} mb={3} color="warning.main">
              {t('fuelCode:notesRequiredWarning')}
            </BCTypography>
          )}
        </div>

        <BCGridEditor
          gridRef={gridRef}
          alertRef={alertRef}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          rowData={rowData}
          onCellValueChanged={onCellValueChanged}
          onCellEditingStopped={onCellEditingStopped}
          onAction={onAction}
          showAddRowsButton={!existingFuelCode && isAnalyst}
          context={{ errors }}
          handlePaste={handlePaste}
        />

        {
          <Stack
            direction={{ md: 'column', lg: 'row' }}
            spacing={{ xs: 2, sm: 2, md: 3 }}
            useFlexGap
            flexWrap="wrap"
          >
            {buttonConfig.map((button) => (
              <BCButton
                key={button.id}
                variant={button.variant}
                size="medium"
                color={button.color}
                startIcon={
                  button.startIcon && (
                    <FontAwesomeIcon
                      icon={button.startIcon}
                      className="small-icon"
                    />
                  )
                }
                onClick={button.handler}
                disabled={button.disabled}
              >
                <BCTypography variant="subtitle2">{button.label}</BCTypography>
              </BCButton>
            ))}
          </Stack>
        }
      </Grid2>

      <BCModal
        open={!!modalData}
        onClose={() => setModalData(null)}
        data={modalData}
      />
    </>
  )
}

export const AddEditFuelCode = withRole(
  AddEditFuelCodeBase,
  [roles.government],
  ROUTES.DASHBOARD
)
