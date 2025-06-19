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
  useApproveFuelCode,
  useCreateFuelCode,
  useDeleteFuelCode,
  useFuelCodeOptions,
  useGetFuelCode,
  useUpdateFuelCode
} from '@/hooks/useFuelCode'
import withRole from '@/utils/withRole'
import { defaultColDef, fuelCodeColDefs } from './_schema'
import { useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons'
import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import { FUEL_CODE_STATUSES } from '@/constants/statuses'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import Papa from 'papaparse'

const AddEditFuelCodeBase = () => {
  const { fuelCodeID } = useParams()
  const gridRef = useRef(null)
  const alertRef = useRef()
  const { t } = useTranslation(['common', 'fuelCode'])

  const [rowData, setRowData] = useState([])
  const [errors, setErrors] = useState({})
  const [warnings, setWarnings] = useState({})
  const [columnDefs, setColumnDefs] = useState([])
  const [isGridReady, setGridReady] = useState(false)
  const [modalData, setModalData] = useState(null)
  const [initialized, setInitialized] = useState(false)

  const { hasRoles } = useCurrentUser()
  const {
    data: optionsData,
    isLoading,
    isFetched,
    refetch: refetchOptions
  } = useFuelCodeOptions()
  const { mutateAsync: updateFuelCode } = useUpdateFuelCode(fuelCodeID)
  const { mutateAsync: createFuelCode } = useCreateFuelCode()
  const { mutateAsync: deleteFuelCode } = useDeleteFuelCode()
  const { mutateAsync: approveFuelCode } = useApproveFuelCode()
  const {
    data: existingFuelCode,
    isLoading: isLoadingExistingCode,
    refetch
  } = useGetFuelCode(fuelCodeID)

  const nonEditableStatuses = useMemo(
    () => [FUEL_CODE_STATUSES.APPROVED, FUEL_CODE_STATUSES.RECOMMENDED],
    []
  )

  const isEditable = useMemo(
    () =>
      !nonEditableStatuses.includes(existingFuelCode?.fuelCodeStatus.status),
    [nonEditableStatuses, existingFuelCode?.fuelCodeStatus.status]
  )

  useEffect(() => {
    // Only initialize rowData once when all data is available and the grid is ready
    if (!initialized && isFetched && !isLoadingExistingCode && isGridReady) {
      if (existingFuelCode) {
        setRowData([existingFuelCode])
      } else {
        const defaultPrefix = optionsData?.fuelCodePrefixes?.find(
          (item) => item.prefix === 'BCLCF'
        )
        setRowData([
          {
            id: uuid(),
            prefixId: defaultPrefix?.fuelCodePrefixId || 1,
            prefix: defaultPrefix?.prefix || 'BCLCF',
            fuelSuffix: defaultPrefix?.nextFuelCode
          }
        ])
      }
      setInitialized(true)
    }
  }, [
    initialized,
    isFetched,
    isLoadingExistingCode,
    isGridReady,
    existingFuelCode,
    optionsData
  ])

  useEffect(() => {
    if (optionsData) {
      const updatedColumnDefs = fuelCodeColDefs(
        optionsData,
        errors,
        !existingFuelCode,
        isEditable && hasRoles(roles.analyst)
      )
      setColumnDefs(updatedColumnDefs)
    }
  }, [errors, optionsData, existingFuelCode, isEditable, hasRoles])

  useEffect(() => {
    if (existingFuelCode) {
      const transformedData = {
        ...existingFuelCode,
        feedstockFuelTransportMode:
          existingFuelCode.feedstockFuelTransportModes.map(
            (mode) => mode.feedstockFuelTransportMode.transportMode
          ),
        finishedFuelTransportMode:
          existingFuelCode.finishedFuelTransportModes.map(
            (mode) => mode.finishedFuelTransportMode.transportMode
          )
      }
      setRowData([transformedData])
    }
  }, [optionsData, existingFuelCode, isGridReady])

  const onGridReady = (params) => {
    setGridReady(true)
    params.api.sizeColumnsToFit()
  }

  const handleError = (_error, message, severity) => {
    alertRef.current?.triggerAlert({
      message,
      severity
    })
  }

  const onCellValueChanged = useCallback(
    async (params) => {
      const updatedData = { ...params.data, modified: true }

      if (params.colDef.field === 'prefix') {
        updatedData.fuelSuffix = optionsData?.fuelCodePrefixes?.find(
          (item) => item.prefix === params.newValue
        )?.nextFuelCode
      }

      params.api.applyTransaction({ update: [updatedData] })
    },
    [optionsData?.fuelCodePrefixes]
  )

  const handleDeleteFuelCode = async (fuelCodeId, params) => {
    if (fuelCodeId) {
      try {
        await deleteFuelCode(fuelCodeId)
        params.api.applyTransaction({ remove: [params.node.data] })
        alertRef.current?.triggerAlert({
          message: 'Row deleted successfully.',
          severity: 'success'
        })
      } catch (error) {
        handleError(error, `Error deleting row: ${error.message}`)
      }
    } else {
      params.api.applyTransaction({ remove: [params.node.data] })
    }
    setModalData(null)
  }

  const handleApproveDraftCode = async (fuelCodeId) => {
    await approveFuelCode(fuelCodeId)
    await refetch()
    setModalData(null)
  }

  const openDeleteModal = (fuelCodeId, params) => {
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
  }

  const openApprovalModal = async (fuelCodeId) => {
    setModalData({
      primaryButtonAction: () => handleApproveDraftCode(fuelCodeId),
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
  }

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

      let updatedData = Object.entries(params.node.data)
        .filter(([, value]) => value !== null && value !== '')
        .reduce((acc, [key, value]) => {
          acc[key] = value
          return acc
        }, {})

      try {
        setErrors({})
        setWarnings({})

        if (updatedData.fuelCodeId) {
          await updateFuelCode(updatedData)
        } else {
          const res = await createFuelCode(updatedData)
          updatedData.fuelCodeId = res.data.fuelCodeId
          updatedData.fuelSuffix = res.data.fuelSuffix
        }

        updatedData = {
          ...updatedData,
          validationStatus: 'success',
          modified: false
        }
        alertRef.current?.triggerAlert({
          message: 'Row updated successfully.',
          severity: 'success'
        })
      } catch (error) {
        setErrors({
          [params.node.data.id]:
            error.response?.data?.errors &&
            error.response.data.errors[0]?.fields
        })

        const isNewRow = !updatedData.fuelCodeId
        const severity = isNewRow ? 'warning' : 'error'

        updatedData = {
          ...updatedData,
          validationStatus: severity
        }

        if (
          error.response?.data?.errors &&
          error.response.data.errors.length > 0
        ) {
          const { fields, message } = error.response.data.errors[0]
          const fieldLabels = fields.map((field) =>
            t(`fuelCode:fuelCodeColLabels.${field}`)
          )
          const errMsg = `Unable to save row: ${
            fieldLabels.length === 1 ? fieldLabels[0] : ''
          } ${message}`
          updatedData.validationMsg = errMsg
          handleError(error, errMsg, severity)
        } else {
          const errMsg = error.response?.data?.detail || error.message
          updatedData.validationMsg = errMsg
          handleError(error, `Unable to save row: ${errMsg}`, severity)
        }
      }

      params.node.updateData(updatedData)
    },
    [updateFuelCode, t, createFuelCode]
  )

  const handlePaste = useCallback(
    (event, { api, columnApi }) => {
      const newData = []
      const clipboardData = event.clipboardData || window.clipboardData
      const pastedData = clipboardData.getData('text/plain')
      const headerRow = api
        .getAllDisplayedColumns()
        .map((column) => column.colDef.field)
        .filter((col) => col)
        .join('\t')
      const parsedData = Papa.parse(headerRow + '\n' + pastedData, {
        delimiter: '\t',
        header: true,
        transform: (value, field) => {
          // Check for date fields and format them
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/ // Matches YYYY-MM-DD format
          if (field.toLowerCase().includes('date') && !dateRegex.test(value)) {
            const parsedDate = new Date(value)
            if (!isNaN(parsedDate)) {
              return parsedDate.toISOString().split('T')[0] // Format as YYYY-MM-DD
            }
          }
          const num = Number(value) // Attempt to convert to a number if possible
          return isNaN(num) ? value : num // Return the number if valid, otherwise keep as string
        },
        skipEmptyLines: true
      })
      if (parsedData.data?.length < 0) {
        return
      }
      parsedData.data.forEach((row) => {
        const newRow = { ...row }
        newRow.id = uuid()
        newRow.prefixId = optionsData?.fuelCodePrefixes?.find(
          (o) => o.prefix === row.prefix
        )?.fuelCodePrefixId
        newRow.fuelTypeId = optionsData?.fuelTypes?.find(
          (o) => o.fuelType === row.fuelType
        )?.fuelTypeId
        newRow.fuelSuffix = newRow.fuelSuffix.toString()
        newRow.feedstockFuelTransportMode = row.feedstockFuelTransportMode
          .split(',')
          .map((item) => item.trim())
        newRow.finishedFuelTransportMode = row.finishedFuelTransportMode
          .split(',')
          .map((item) => item.trim())
        newRow.modified = true
        newData.push(newRow)
      })
      const transactions = api.applyTransaction({ add: newData })
      // Trigger onCellEditingStopped event to update the row in backend.
      transactions.add.forEach((node) => {
        onCellEditingStopped({
          node,
          oldValue: '',
          newvalue: undefined,
          ...api
        })
      })
    },
    [onCellEditingStopped, optionsData]
  )

  const duplicateFuelCode = async (params) => {
    const originalData = params.data
    const originalPrefix = originalData.prefix || 'BCLCF'

    const updatedOptions = await refetchOptions()
    const selectedPrefix = updatedOptions.data.fuelCodePrefixes?.find(
      (p) => p.prefix === originalPrefix
    )

    const newRow = {
      ...originalData,
      id: uuid(),
      fuelCodeId: null,
      modified: true,
      isValid: false,
      validationStatus: 'error',
      validationMsg: 'Fill in the missing fields'
    }

    if (selectedPrefix) {
      newRow.prefixId = selectedPrefix.fuelCodePrefixId
      newRow.prefix = selectedPrefix.prefix
      newRow.fuelSuffix = selectedPrefix.nextFuelCode
    }

    if (params.api) {
      if (originalData.fuelCodeId) {
        try {
          // If the original was a saved row, create a new code in the backend
          const response = await createFuelCode(newRow)
          const updatedData = {
            ...response.data,
            id: uuid(),
            modified: false,
            isValid: false,
            validationStatus: 'error'
          }
          return { add: [updatedData] }
        } catch (error) {
          handleError(error, `Error duplicating row: ${error.message}`)
        }
      } else {
        // If the original row wasn’t saved, just return the transaction
        return { add: [newRow] }
      }
    }
  }

  const handleOpenApprovalModal = useCallback(() => {
    openApprovalModal(fuelCodeID)
  }, [fuelCodeID])

  const onAction = useCallback(
    async (action, params) => {
      if (action === 'duplicate') {
        return await duplicateFuelCode(params)
      } else if (action === 'delete') {
        await openDeleteModal(params.data.fuelCodeId, params)
      } else if (action === 'add') {
        // Refetch options to get updated nextFuelCode
        const updatedOptions = await refetchOptions()
        const defaultPrefix = updatedOptions.data.fuelCodePrefixes.find(
          (item) => item.prefix === 'BCLCF'
        )

        const newRow = {
          id: uuid(),
          prefixId: defaultPrefix.fuelCodePrefixId,
          prefix: defaultPrefix.prefix,
          fuelSuffix: defaultPrefix.nextFuelCode,
          modified: true,
          validationStatus: 'error',
          validationMsg: 'Fill in missing fields'
        }

        // Return a transaction (no resetting rowData)
        return { add: [newRow] }
      }
    },
    [duplicateFuelCode, refetchOptions]
  )

  if (isLoading || isLoadingExistingCode) {
    return <Loading />
  }

  return (
    isFetched && (
      <>
        <Grid2 className="add-edit-fuel-code-container" mx={-1}>
          <div className="header">
            <BCTypography variant="h5" color="primary">
              {!existingFuelCode && t('fuelCode:newFuelCodeTitle')}
              {existingFuelCode?.fuelCodeStatus.status ===
                FUEL_CODE_STATUSES.DRAFT && t('fuelCode:editFuelCodeTitle')}
              {existingFuelCode?.fuelCodeStatus.status ===
                FUEL_CODE_STATUSES.RECOMMENDED &&
                t('fuelCode:viewFuelCodeTitle')}
              {existingFuelCode?.fuelCodeStatus.status ===
                FUEL_CODE_STATUSES.APPROVED && t('fuelCode:viewFuelCodeTitle')}
            </BCTypography>
            <BCTypography variant="body2" mt={2} mb={3}>
              {(!existingFuelCode ||
                existingFuelCode?.fuelCodeStatus.status ===
                  FUEL_CODE_STATUSES.DRAFT) &&
                t('fuelCode:fuelCodeEntryGuide')}
            </BCTypography>
          </div>
          <BCGridEditor
            gridRef={gridRef}
            alertRef={alertRef}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            rowData={rowData} // Only set once, do not update again
            onCellValueChanged={onCellValueChanged}
            onCellEditingStopped={onCellEditingStopped}
            onAction={onAction}
            showAddRowsButton={!existingFuelCode && hasRoles(roles.analyst)}
            context={{ errors }}
            handlePaste={handlePaste}
          />
          {isEditable && (
            <Stack
              direction={{ md: 'column', lg: 'row' }}
              spacing={{ xs: 2, sm: 2, md: 3 }}
              useFlexGap
              flexWrap="wrap"
            >
              <BCButton
                variant="contained"
                size="medium"
                color="primary"
                startIcon={
                  <FontAwesomeIcon icon={faFloppyDisk} className="small-icon" />
                }
                onClick={handleOpenApprovalModal}
              >
                <BCTypography variant="subtitle2">
                  {t('fuelCode:approveFuelCodeBtn')}
                </BCTypography>
              </BCButton>
            </Stack>
          )}
        </Grid2>
        <BCModal
          open={!!modalData}
          onClose={() => setModalData(null)}
          data={modalData}
        />
      </>
    )
  )
}

export const AddEditFuelCode = withRole(
  AddEditFuelCodeBase,
  [roles.government],
  ROUTES.DASHBOARD
)
