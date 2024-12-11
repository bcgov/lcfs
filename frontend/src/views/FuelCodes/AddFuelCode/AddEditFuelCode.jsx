import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Stack } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { v4 as uuid } from 'uuid'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import Loading from '@/components/Loading'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
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
  const [columnDefs, setColumnDefs] = useState([])
  const [isGridReady, setGridReady] = useState(false)
  const [modalData, setModalData] = useState(null)

  const { hasRoles } = useCurrentUser()
  const { data: optionsData, isLoading, isFetched } = useFuelCodeOptions()
  const { mutateAsync: updateFuelCode } = useUpdateFuelCode(fuelCodeID)
  const { mutateAsync: createFuelCode } = useCreateFuelCode()
  const { mutateAsync: deleteFuelCode } = useDeleteFuelCode()
  const { mutateAsync: approveFuelCode } = useApproveFuelCode()
  const {
    data: existingFuelCode,
    isLoading: isLoadingExistingCode,
    refetch
  } = useGetFuelCode(fuelCodeID)

  useEffect(() => {
    if (optionsData) {
      const updatedColumnDefs = fuelCodeColDefs(
        optionsData,
        errors,
        !existingFuelCode,
        existingFuelCode?.fuelCodeStatus.status !==
          FUEL_CODE_STATUSES.APPROVED && hasRoles(roles.analyst)
      )
      setColumnDefs(updatedColumnDefs)
    }
  }, [errors, optionsData, existingFuelCode])

  useEffect(() => {
    if (existingFuelCode) {
      setRowData([existingFuelCode])
    } else {
      setRowData([
        {
          id: uuid(),
          prefixId: 1,
          fuelSuffix: optionsData?.fuelCodePrefixes?.find(
            (item) => item.prefix === 'BCLCF'
          ).nextFuelCode
        }
      ])
    }
  }, [optionsData, existingFuelCode, isGridReady])

  const onGridReady = (params) => {
    setGridReady(true)
    params.api.sizeColumnsToFit()
  }

  const handleError = (error, message) => {
    console.error(error)
    alertRef.current?.triggerAlert({
      message,
      severity: 'error'
    })
  }

  const onCellValueChanged = useCallback(
    async (params) => {
      const updatedData = { ...params.data, modified: true }

      if (params.colDef.field === 'prefix') {
        updatedData.fuelSuffix = optionsData?.fuelCodePrefixes?.find(
          (item) => item.prefix === params.newValue
        ).nextFuelCode
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
            error.response.data?.errors &&
            error.response.data?.errors[0]?.fields
        })

        updatedData = {
          ...updatedData,
          validationStatus: 'error'
        }

        if (
          error.response?.data?.errors &&
          error.response.data.errors.length > 0
        ) {
          const { fields, message } = error.response.data.errors[0]
          const fieldLabels = fields.map((field) =>
            t(`fuelCode:fuelCodeColLabels.${field}`)
          )
          const errMsg = `Error updating row: ${
            fieldLabels.length === 1 ? fieldLabels[0] : ''
          } ${message}`
          updatedData.validationMsg = errMsg
          handleError(error, errMsg)
        } else {
          const errMsg = error.response?.data?.detail || error.message
          updatedData.validationMsg = errMsg
          handleError(error, `Error updating row: ${errMsg}`)
        }
      }

      params.node.updateData(updatedData)
    },
    [updateFuelCode, t]
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
    const rowData = {
      ...params.data,
      id: uuid(),
      fuelCodeId: null,
      modified: true,
      isValid: false,
      validationStatus: 'error',
      validationMsg: 'Fill in the missing fields'
    }
    if (params.api) {
      if (params.data.fuelCodeId) {
        try {
          const response = await updateFuelCode(rowData)
          const updatedData = {
            ...response.data,
            id: uuid(),
            modified: false,
            isValid: false,
            validationStatus: 'error'
          }
          params.api.applyTransaction({
            add: [updatedData],
            addIndex: params.node?.rowIndex + 1
          })
          params.api.refreshCells()
          alertRef.current?.triggerAlert({
            message: 'Row duplicated successfully.',
            severity: 'success'
          })
        } catch (error) {
          handleError(error, `Error duplicating row: ${error.message}`)
        }
      } else {
        params.api.applyTransaction({
          add: [rowData],
          addIndex: params.node?.rowIndex + 1
        })
      }
    }
  }

  const handleOpenApprovalModal = useCallback(() => {
    openApprovalModal(fuelCodeID)
  }, [fuelCodeID])

  const onAction = useCallback(
    async (action, params) => {
      if (action === 'duplicate') {
        await duplicateFuelCode(params)
      } else if (action === 'delete') {
        await openDeleteModal(params.data.fuelCodeId, params)
      }
    },
    [updateFuelCode, deleteFuelCode]
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
                FUEL_CODE_STATUSES.APPROVED && t('fuelCode:viewFuelCodeTitle')}
            </BCTypography>
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
            showAddRowsButton={!existingFuelCode && hasRoles(roles.analyst)}
            context={{ errors }}
            handlePaste={handlePaste}
          />
          {existingFuelCode?.fuelCodeStatus.status !==
            FUEL_CODE_STATUSES.APPROVED && (
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
