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

const transformExistingFuelCodeData = (existingFuelCode) => {
  if (!existingFuelCode) return null

  return {
    ...existingFuelCode,
    id: existingFuelCode.id || uuid(),
    feedstockFuelTransportMode:
      existingFuelCode.feedstockFuelTransportModes?.map(
        (mode) => mode.feedstockFuelTransportMode.transportMode
      ) || [],
    finishedFuelTransportMode:
      existingFuelCode.finishedFuelTransportModes?.map(
        (mode) => mode.finishedFuelTransportMode.transportMode
      ) || []
  }
}

const createDefaultRow = (optionsData) => {
  const defaultPrefix = optionsData?.fuelCodePrefixes?.find(
    (item) => item.prefix === DEFAULT_PREFIX
  )
  return {
    id: uuid(),
    prefixId: defaultPrefix?.fuelCodePrefixId || 1,
    prefix: defaultPrefix?.prefix || DEFAULT_PREFIX,
    fuelSuffix: defaultPrefix?.nextFuelCode,
    isNewRow: true,
    modified: false
  }
}

const filterNonNullValues = (data) => {
  const result = {}
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== '') {
      result[key] = value
    }
  }
  return result
}

const AddEditFuelCodeBase = () => {
  const { fuelCodeID } = useParams()
  const gridRef = useRef(null)
  const alertRef = useRef()
  const { t } = useTranslation(['common', 'fuelCode'])
  const navigate = useNavigate()

  // Consolidated state
  const [state, setState] = useState({
    rowData: [],
    errors: {},
    columnDefs: [],
    isGridReady: false,
    modalData: null,
    initialized: false,
    isInEditMode: false,
    originalStatus: null,
    pendingUpdates: new Set(),
    isUpdating: false,
    isButtonOperationInProgress: false,
    currentButtonOperation: null
  })

  const {
    rowData,
    errors,
    columnDefs,
    isGridReady,
    modalData,
    initialized,
    isInEditMode,
    originalStatus,
    pendingUpdates,
    isUpdating
  } = state

  // state setters
  const updateState = useCallback((updates) => {
    setState((prev) => ({ ...prev, ...updates }))
  }, [])

  const updatePendingUpdates = useCallback((updater) => {
    setState((prev) => ({
      ...prev,
      pendingUpdates:
        typeof updater === 'function' ? updater(prev.pendingUpdates) : updater
    }))
  }, [])
  const setButtonOperationState = useCallback(
    (isLoading, operationName = null) => {
      setState((prev) => ({
        ...prev,
        isButtonOperationInProgress: isLoading,
        currentButtonOperation: isLoading ? operationName : null
      }))
    },
    []
  )
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

  const getRowId = useCallback((params) => {
    if (params.data.id) return params.data.id
    const newId = uuid()
    params.data.id = newId
    return newId
  }, [])

  const computedValues = useMemo(() => {
    const isEditable = !NON_EDITABLE_STATUSES.includes(
      existingFuelCode?.fuelCodeStatus.status
    )
    const isAnalyst = hasRoles(roles.analyst)
    const transformedExistingData =
      transformExistingFuelCodeData(existingFuelCode)

    const shouldShowEditButton =
      !isInEditMode && existingFuelCode && !isUpdating
    const shouldShowSaveButton =
      (isInEditMode || !existingFuelCode) && !isUpdating

    let titleText = t('fuelCode:newFuelCodeTitle')
    if (existingFuelCode) {
      const status = existingFuelCode.fuelCodeStatus.status
      titleText =
        status === FUEL_CODE_STATUSES.DRAFT && isInEditMode
          ? t('fuelCode:editFuelCodeTitle')
          : t('fuelCode:viewFuelCodeTitle')
    }
    debugger
    const showGuideText =
      !existingFuelCode ||
      existingFuelCode.fuelCodeStatus.status === FUEL_CODE_STATUSES.DRAFT

    const isNotesRequired =
      existingFuelCode?.fuelCodeStatus.status === FUEL_CODE_STATUSES.DRAFT &&
      existingFuelCode?.isNotesRequired

    const hasNotesValidationError =
      isNotesRequired && (!rowData[0]?.notes || rowData[0].notes.trim() === '')

    return {
      isEditable,
      isAnalyst,
      transformedExistingData,
      shouldShowEditButton,
      shouldShowSaveButton,
      titleText,
      showGuideText,
      isNotesRequired,
      hasNotesValidationError
    }
  }, [existingFuelCode, hasRoles, isInEditMode, isUpdating, t, rowData])

  // Track original status when fuel code is first loaded
  useEffect(() => {
    if (existingFuelCode && originalStatus === null) {
      updateState({ originalStatus: existingFuelCode.fuelCodeStatus.status })
    }
  }, [existingFuelCode, originalStatus, updateState])

  // Initialize row data once when all dependencies are ready
  useEffect(() => {
    if (!initialized && isFetched && !isLoadingExistingCode && isGridReady) {
      const initialData = computedValues.transformedExistingData
        ? [
            {
              ...computedValues.transformedExistingData,
              id: computedValues.transformedExistingData.id || uuid()
            }
          ]
        : [createDefaultRow(optionsData)]

      updateState({
        rowData: initialData,
        initialized: true
      })
    }
  }, [
    initialized,
    isFetched,
    isLoadingExistingCode,
    isGridReady,
    computedValues.transformedExistingData,
    optionsData,
    updateState
  ])

  const enhancedColumnDefs = useMemo(() => {
    if (!optionsData) return []

    const canEditGrid = (isInEditMode || !existingFuelCode) && !isUpdating
    const updatedColumnDefs = fuelCodeColDefs(
      optionsData,
      errors,
      !existingFuelCode,
      canEditGrid,
      computedValues.isNotesRequired,
      existingFuelCode?.canEditCi
    )

    return updatedColumnDefs.map((colDef) => ({
      ...colDef,
      editable: (params) => {
        const isRowUpdating = pendingUpdates.has(params.data.id)
        const originalEditable =
          typeof colDef.editable === 'function'
            ? colDef.editable(params)
            : colDef.editable
        return originalEditable && !isRowUpdating && !isUpdating
      }
    }))
  }, [
    optionsData,
    errors,
    existingFuelCode,
    isInEditMode,
    computedValues.isNotesRequired,
    pendingUpdates,
    isUpdating
  ])

  // Update column definitions
  useEffect(() => {
    updateState({ columnDefs: enhancedColumnDefs })
  }, [enhancedColumnDefs, updateState])

  const gridOptions = useMemo(
    () => ({
      getRowId,
      suppressClickEdit: isUpdating,
      suppressCellSelection: isUpdating,
      suppressRowDrag: isUpdating,
      suppressRowClick: isUpdating,
      loadingOverlayComponent: 'customLoadingOverlay',
      loadingOverlayComponentParams: {
        loadingMessage: 'Updating data...'
      }
    }),
    [isUpdating, getRowId]
  )

  const getRowStyle = useCallback(
    (params) => {
      const isRowUpdating = pendingUpdates.has(params.data.id)
      return {
        opacity: isRowUpdating ? 0.6 : 1,
        pointerEvents: isRowUpdating ? 'none' : 'auto',
        background: isRowUpdating ? '#f5f5f5' : 'transparent'
      }
    },
    [pendingUpdates]
  )

  const onGridReady = useCallback(
    (params) => {
      updateState({ isGridReady: true })
      params.api.sizeColumnsToFit()
    },
    [updateState]
  )

  const handleError = useCallback((error, message, severity = 'error') => {
    console.error('Error:', error)
    alertRef.current?.triggerAlert({ message, severity })
  }, [])

  const updateRowWithValidation = useCallback(
    async (params, updatedData) => {
      const rowId = params.node.data.id || uuid()

      try {
        // Add to pending updates
        updatePendingUpdates((prev) => new Set([...prev, rowId]))
        updateState({ isUpdating: true })

        // Clear previous errors for this row
        updateState((prev) => ({
          errors: { ...prev.errors, [rowId]: undefined }
        }))

        const action =
          updatedData.validationStatus === 'pending'
            ? 'save'
            : updatedData.fuelCodeId
              ? 'update'
              : 'create'

        const result = await fuelCodeMutation.mutateAsync({
          action,
          data: { ...updatedData, id: rowId },
          fuelCodeId: updatedData.fuelCodeId
        })

        const finalData = {
          ...updatedData,
          id: rowId,
          fuelCodeId: result.data.fuelCodeId,
          fuelSuffix: result.data.fuelSuffix,
          validationStatus: 'success',
          isNewRow: false,
          modified: false
        }

        alertRef.current?.triggerAlert({
          message: 'Row updated successfully.',
          severity: 'success'
        })

        return finalData
      } catch (error) {
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

        // Update errors state
        updateState((prev) => ({
          errors: {
            ...prev.errors,
            [rowId]: error.response?.data?.errors?.[0]?.fields
          }
        }))

        handleError(error, errMsg, severity)

        return {
          ...updatedData,
          id: rowId,
          validationStatus: severity,
          validationMsg: errMsg
        }
      } finally {
        // Remove from pending updates
        updatePendingUpdates((prev) => {
          const newSet = new Set(prev)
          newSet.delete(rowId)
          return newSet
        })

        // Update global updating state
        setTimeout(() => {
          updatePendingUpdates((current) => {
            if (current.size === 0) {
              updateState({ isUpdating: false })
            }
            return current
          })
        }, 0)
      }
    },
    [fuelCodeMutation, t, handleError, updatePendingUpdates, updateState]
  )

  const onCellValueChanged = useCallback(
    (params) => {
      const rowId = params.data.id || uuid()
      if (!params.data.id) {
        params.data.id = rowId
      }

      const updatedData = {
        ...params.data,
        id: rowId,
        modified: true
      }

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

  const onCellEditingStopped = useCallback(
    async (params) => {
      if (params.oldValue === params.newValue) return

      const rowId = params.node.data.id || uuid()
      if (!params.node.data.id) {
        params.node.data.id = rowId
      }

      if (pendingUpdates.has(rowId)) {
        alertRef.current?.triggerAlert({
          message: 'Please wait for the current update to complete.',
          severity: 'warning'
        })
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

      const filteredData = filterNonNullValues(params.node.data)
      const finalData = await updateRowWithValidation(params, filteredData)
      params.node.updateData(finalData)
    },
    [updateRowWithValidation, pendingUpdates]
  )

  const handleSaveSuccess = useCallback(async () => {
    await refetch()
    updateState({ isInEditMode: false, modalData: null })
    navigate(ROUTES.FUEL_CODES.LIST, {
      state: {
        message: t(
          'fuelCode:saveSuccessMessage',
          'Fuel code saved successfully.'
        ),
        severity: 'success'
      }
    })
  }, [refetch, t, navigate, updateState])

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
      updateState({ modalData: null })
    },
    [fuelCodeMutation, handleError, updateState]
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
        updateState({ modalData: null })
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
    [fuelCodeMutation, refetch, t, handleError, updateState]
  )

  const openDeleteModal = useCallback(
    (fuelCodeId, params) => {
      updateState({
        modalData: {
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
        }
      })
    },
    [handleDeleteFuelCode, t, updateState]
  )

  const openApprovalModal = useCallback(
    (fuelCodeId) => {
      updateState({
        modalData: {
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
        }
      })
    },
    [handleApproveCode, t, updateState]
  )

  const parsePastedData = useCallback((pastedData, headerRow) => {
    return Papa.parse(headerRow + '\n' + pastedData, {
      delimiter: '\t',
      header: true,
      transform: (value, field) => {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/
        if (field.toLowerCase().includes('date') && !dateRegex.test(value)) {
          const parsedDate = new Date(value)
          if (!isNaN(parsedDate)) {
            return parsedDate.toISOString().split('T')[0]
          }
        }
        const num = Number(value)
        return isNaN(num) ? value : num
      },
      skipEmptyLines: true
    })
  }, [])

  const handlePaste = useCallback(
    (event, { api }) => {
      if (isUpdating) return

      const clipboardData = event.clipboardData || window.clipboardData
      const pastedData = clipboardData.getData('text/plain')

      const headerRow = api
        .getAllDisplayedColumns()
        .map((column) => column.colDef.field)
        .filter(Boolean)
        .join('\t')

      const parsedData = parsePastedData(pastedData, headerRow)
      if (!parsedData.data?.length) return

      const newData = parsedData.data.map((row) => ({
        ...row,
        id: uuid(),
        prefixId: optionsData?.fuelCodePrefixes?.find(
          (o) => o.prefix === row.prefix
        )?.fuelCodePrefixId,
        fuelTypeId: optionsData?.fuelTypes?.find(
          (o) => o.fuelType === row.fuelType
        )?.fuelTypeId,
        fuelSuffix: row.fuelSuffix?.toString(),
        feedstockFuelTransportMode:
          row.feedstockFuelTransportMode
            ?.split(',')
            .map((item) => item.trim()) || [],
        finishedFuelTransportMode:
          row.finishedFuelTransportMode
            ?.split(',')
            .map((item) => item.trim()) || [],
        modified: true,
        isNewRow: true
      }))

      const transactions = api.applyTransaction({ add: newData })
      transactions.add.forEach((node) => {
        onCellEditingStopped({
          node,
          oldValue: '',
          newValue: undefined
        })
      })
    },
    [parsePastedData, onCellEditingStopped, optionsData, isUpdating]
  )

  const duplicateFuelCode = useCallback(
    async (params) => {
      const originalData = params.data
      const originalPrefix = originalData.prefix || DEFAULT_PREFIX
      const newRowId = uuid()

      try {
        const updatedOptions = await refetchOptions()
        const selectedPrefix = updatedOptions.data.fuelCodePrefixes?.find(
          (p) => p.prefix === originalPrefix
        )

        const newRow = {
          ...originalData,
          id: newRowId,
          fuelCodeId: null,
          modified: true,
          isNewRow: true,
          validationStatus: 'error',
          validationMsg: 'Fill in the missing fields'
        }

        if (selectedPrefix) {
          Object.assign(newRow, {
            prefixId: selectedPrefix.fuelCodePrefixId,
            prefix: selectedPrefix.prefix,
            fuelSuffix: selectedPrefix.nextFuelCode
          })
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
                id: newRowId,
                modified: false,
                isNewRow: false,
                validationStatus: 'success'
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
                isNewRow: true,
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

  const buttonContext = useMemo(() => {
    const baseHandlers = {
      handleSave: async () => {
        debugger
        if (state.isButtonOperationInProgress) return
        try {
          setButtonOperationState(true, 'save')
          if (computedValues.hasNotesValidationError) {
            alertRef.current?.triggerAlert({
              message: t('fuelCode:notesRequiredMessage'),
              severity: 'error'
            })
            return
          }
          await handleSaveSuccess()
        } catch (error) {
          handleError(error, `Error saving fuel code: ${error.message}`)
        } finally {
          setButtonOperationState(false)
        }
      },
      handleEdit: async () => {
        if (state.isButtonOperationInProgress) return
        try {
          debugger
          setButtonOperationState(true, 'edit')
          if (originalStatus === null && existingFuelCode) {
            updateState({
              originalStatus: existingFuelCode.fuelCodeStatus.status
            })
          }
          if (
            existingFuelCode.fuelCodeStatus.status !== FUEL_CODE_STATUSES.DRAFT
          ) {
            await fuelCodeMutation.mutateAsync({
              action: 'update',
              data: { status: FUEL_CODE_STATUSES.DRAFT },
              fuelCodeId: fuelCodeID
            })
            await refetch()
          }
          updateState({ isInEditMode: true, modalData: null })
          alertRef.current?.triggerAlert({
            message: t('fuelCode:editModeEnabledMessage'),
            severity: 'success'
          })
        } catch (error) {
          handleError(error, `Error enabling edit mode: ${error.message}`)
        } finally {
          setButtonOperationState(false)
        }
      },
      handleRecommend: async () => {
        if (state.isButtonOperationInProgress) return
        try {
          setButtonOperationState(true, 'recommend')
          await fuelCodeMutation.mutateAsync({
            action: 'update',
            data: { status: FUEL_CODE_STATUSES.RECOMMENDED },
            fuelCodeId: fuelCodeID
          })
          await refetch()
          updateState({ modalData: null })
          alertRef.current?.triggerAlert({
            message: t('fuelCode:recommendSuccessMessage'),
            severity: 'success'
          })
        } catch (error) {
          handleError(error, `Error recommending fuel code: ${error.message}`)
        } finally {
          setButtonOperationState(false)
        }
      },
      handleApprove: async () => {
        if (state.isButtonOperationInProgress) return
        try {
          setButtonOperationState(true, 'approve')
          await fuelCodeMutation.mutateAsync({
            action: 'update',
            data: { status: FUEL_CODE_STATUSES.APPROVED },
            fuelCodeId: fuelCodeID
          })
          await refetch()
          updateState({ modalData: null })
          alertRef.current?.triggerAlert({
            message: t('fuelCode:approveSuccessMessage'),
            severity: 'success'
          })
        } catch (error) {
          handleError(error, `Error approving fuel code: ${error.message}`)
        } finally {
          setButtonOperationState(false)
        }
      },
      handleDelete: async () => {
        if (state.isButtonOperationInProgress) return
        try {
          setButtonOperationState(true, 'delete')
          if (fuelCodeID) {
            await fuelCodeMutation.mutateAsync({
              action: 'delete',
              fuelCodeId: fuelCodeID
            })
            updateState({ modalData: null })
            navigate(ROUTES.FUEL_CODES.LIST, {
              state: {
                message: t('fuelCode:deleteSuccessMessage'),
                severity: 'success'
              }
            })
          }
        } catch (error) {
          handleError(error, `Error deleting fuel code: ${error.message}`)
        } finally {
          setButtonOperationState(false)
        }
      },
      handleReturnToAnalyst: async () => {
        if (state.isButtonOperationInProgress) return
        try {
          setButtonOperationState(true, 'return')
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
          updateState({ modalData: null })
          alertRef.current?.triggerAlert({
            message: t('fuelCode:returnToAnalystSuccessMessage'),
            severity: 'success'
          })
        } catch (error) {
          handleError(error, `Error returning to analyst: ${error.message}`)
        } finally {
          setButtonOperationState(false)
        }
      }
    }

    return buildFuelCodeButtonContext({
      fuelCode: existingFuelCode,
      hasRoles,
      t,
      setModalData: (data) => updateState({ modalData: data }),
      ...baseHandlers,
      hasChanges: rowData.some((row) => row.modified),
      hasValidationErrors:
        Object.keys(errors).length > 0 ||
        computedValues.hasNotesValidationError,
      isComplete: !!existingFuelCode,
      canEdit: computedValues.isEditable && !isUpdating,
      canDelete:
        computedValues.isEditable &&
        !isUpdating &&
        (!fuelCodeID ||
          existingFuelCode?.fuelCodeStatus.status === FUEL_CODE_STATUSES.DRAFT),
      shouldShowEditButton: computedValues.shouldShowEditButton,
      shouldShowSaveButton: computedValues.shouldShowSaveButton,
      isInEditMode,
      isUpdating,
      isButtonOperationInProgress: state.isButtonOperationInProgress,
      currentButtonOperation: state.currentButtonOperation
    })
  }, [
    existingFuelCode,
    hasRoles,
    t,
    rowData,
    errors,
    computedValues,
    isUpdating,
    fuelCodeID,
    originalStatus,
    isInEditMode,
    handleSaveSuccess,
    handleError,
    fuelCodeMutation,
    refetch,
    updateState,
    state.isButtonOperationInProgress,
    state.currentButtonOperation,
    setButtonOperationState
  ])

  const buttonConfig = useMemo(() => {
    const config = fuelCodeButtonConfigFn(buttonContext)
    return config[buttonContext.currentStatus] || []
  }, [buttonContext])

  // Loading states
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
            {computedValues.titleText}
          </BCTypography>
          {computedValues.showGuideText && isInEditMode && (
            <BCTypography variant="body2" mt={2} mb={3}>
              {t('fuelCode:fuelCodeEntryGuide')}
            </BCTypography>
          )}
          {computedValues.isNotesRequired && isInEditMode && (
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
          showAddRowsButton={
            !existingFuelCode && computedValues.isAnalyst && !isUpdating
          }
          context={{ errors, pendingUpdates, isUpdating }}
          handlePaste={isUpdating ? undefined : handlePaste}
          gridOptions={gridOptions}
          getRowStyle={getRowStyle}
          loading={isUpdating}
          loadingText="Updating data..."
          showMandatoryColumns={isInEditMode}
        />

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
              loading={state.isButtonOperationInProgress}
              onClick={button.handler}
              disabled={
                button.disabled ||
                isUpdating ||
                state.isButtonOperationInProgress
              }
            >
              <BCTypography variant="subtitle2">{button.label}</BCTypography>
            </BCButton>
          ))}
        </Stack>
      </Grid2>

      <BCModal
        open={!!modalData}
        onClose={() =>
          !state.isButtonOperationInProgress && updateState({ modalData: null })
        }
        data={
          modalData
            ? {
                ...modalData,
                primaryButtonAction: state.isButtonOperationInProgress
                  ? undefined
                  : modalData.primaryButtonAction,
                primaryButtonDisabled: state.isButtonOperationInProgress
              }
            : null
        }
      />
    </>
  )
}

export const AddEditFuelCode = withRole(
  AddEditFuelCodeBase,
  [roles.government],
  ROUTES.DASHBOARD
)
