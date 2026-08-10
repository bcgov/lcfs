import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Box, Stack } from '@mui/material'

import BCTypography from '@/components/BCTypography'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import { useFuelCodeOptions } from '@/hooks/useFuelCode'
import { useUpdateCIApplicationGeneratedFuelCode } from '@/hooks/useCIApplication'
import {
  defaultColDef,
  fuelCodeColDefs
} from '@/views/FuelCodes/AddFuelCode/_schema'
import type { OptionsData } from '@/types/schema'

type GeneratedFuelCodesSectionProps = {
  ciApplication: any
  readOnly?: boolean
}

const getValidationStatus = (row: any) => {
  if (row?.isValid) return 'success'
  if (row?.validationErrors || row?.validationMsg) return 'error'
  return undefined
}

const toGridRow = (row: any) => ({
  ...row,
  validationStatus: getValidationStatus(row)
})

const getValidationFields = (row: any) =>
  Object.keys(
    row?.validationErrors ||
      (row?.validationMsg && typeof row.validationMsg === 'object'
        ? row.validationMsg
        : {})
  )

const toErrorMap = (rows: any[]) =>
  rows.reduce(
    (acc, row) => {
      const rowErrors = getValidationFields(row)
      if (row?.id && rowErrors.length) {
        acc[row.id] = rowErrors
      }
      return acc
    },
    {} as Record<string, string[]>
  )

const toUpdatePayload = (row: any) => {
  const {
    id,
    pathwayId,
    pathwayLabel,
    isValid,
    validationMsg,
    validationErrors,
    validationStatus,
    ...rest
  } = row
  return rest
}

const replaceRow = (rows: any[], nextRow: any) =>
  rows.map((row) => (row.id === nextRow.id ? nextRow : row))

const formatFastApiDetail = (detail: any) => {
  if (!Array.isArray(detail)) return detail
  return detail
    .map((item) => {
      const loc = Array.isArray(item?.loc) ? item.loc.join('.') : item?.loc
      return [loc, item?.msg].filter(Boolean).join(': ')
    })
    .filter(Boolean)
    .join('; ')
}

const getErrorMessage = (error: any, fallback: string) => {
  if (error?.response?.data?.errors?.[0]) {
    const { fields, message } = error.response.data.errors[0]
    const fieldText = fields?.length === 1 ? `${fields[0]} ` : ''
    return `Unable to save row: ${fieldText}${message}`
  }
  return (
    formatFastApiDetail(error?.response?.data?.detail) ||
    error?.message ||
    fallback
  )
}

const getErrorFields = (error: any) =>
  error?.response?.data?.errors?.[0]?.fields || []

export const GeneratedFuelCodesSection = ({
  ciApplication,
  readOnly = false
}: GeneratedFuelCodesSectionProps) => {
  const { t } = useTranslation(['carbonIntensity'])
  const gridRef = useRef<any>(null)
  const alertRef = useRef<any>(null)
  const ciApplicationId = ciApplication?.ciApplicationId
  const { data: fuelCodeOptions } = useFuelCodeOptions({}, {})
  const { mutateAsync: updateGeneratedFuelCode } =
    useUpdateCIApplicationGeneratedFuelCode(ciApplicationId)

  const [rowData, setRowData] = useState<any[]>([])
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set())
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    const nextRows = (ciApplication?.generatedFuelCodes || []).map(toGridRow)
    setRowData(nextRows)
    setErrors(toErrorMap(nextRows))
  }, [ciApplication])

  const columnDefs = useMemo(() => {
    const baseDefs = fuelCodeColDefs(
      fuelCodeOptions as OptionsData | undefined,
      errors,
      false,
      !readOnly,
      false,
      true
    ).map((col: any) => {
      if (col.colId === 'action') {
        return { ...col, hide: true }
      }
      return {
        ...col,
        editable: (params: any) => {
          const isRowUpdating = pendingUpdates.has(params.data.id)
          const originalEditable =
            typeof col.editable === 'function'
              ? col.editable(params)
              : col.editable
          return originalEditable && !isRowUpdating && !isUpdating
        }
      }
    })

    return [
      {
        field: 'pathwayLabel',
        headerName: 'Pathway',
        editable: false,
        minWidth: 130,
        pinned: 'left'
      },
      ...baseDefs
    ]
  }, [errors, fuelCodeOptions, isUpdating, pendingUpdates, readOnly])

  const popupParent = useMemo(
    () => (typeof document === 'undefined' ? undefined : document.body),
    []
  )

  const gridOptions = useMemo(
    () => ({
      suppressClickEdit: isUpdating,
      suppressCellSelection: isUpdating,
      suppressRowDrag: isUpdating,
      suppressRowClick: isUpdating
    }),
    [isUpdating]
  )

  const getRowStyle = useCallback(
    (params: any) => {
      const isRowUpdating = pendingUpdates.has(params.data.id)
      return {
        opacity: isRowUpdating ? 0.6 : 1,
        pointerEvents: isRowUpdating ? 'none' : 'auto',
        background: isRowUpdating ? '#f5f5f5' : 'transparent'
      }
    },
    [pendingUpdates]
  )

  const onCellValueChanged = useCallback((params: any) => {
    const updatedData = {
      ...params.data,
      modified: true
    }
    params.api.applyTransaction({ update: [updatedData] })
    setRowData((prev) => replaceRow(prev, updatedData))
  }, [])

  const updateRowWithValidation = useCallback(
    async (updatedData: any) => {
      const rowId = updatedData.id

      setPendingUpdates((prev) => new Set([...prev, rowId]))
      setIsUpdating(true)
      setErrors((prev) => ({ ...prev, [rowId]: [] }))

      try {
        const updatedRow = await updateGeneratedFuelCode({
          generatedFuelCodeId: rowId,
          payload: toUpdatePayload(updatedData)
        })
        const nextRow = toGridRow(updatedRow)
        const nextMessage = nextRow.isValid
          ? t('carbonIntensity:step5.generatedFuelCodeRowSaved')
          : nextRow.validationMsg ||
            t('carbonIntensity:step5.generatedFuelCodeRowIncomplete')
        setErrors((prev) => ({
          ...prev,
          [nextRow.id]: getValidationFields(nextRow)
        }))
        alertRef.current?.triggerAlert?.({
          message: nextMessage,
          severity: nextRow.isValid ? 'success' : 'warning'
        })
        return nextRow
      } catch (error: any) {
        const fallback = t(
          'carbonIntensity:step5.generatedFuelCodeRowSaveError'
        )
        const errorMessage = getErrorMessage(error, fallback)
        const errorFields = getErrorFields(error)
        setErrors((prev) => ({
          ...prev,
          [rowId]: errorFields
        }))
        alertRef.current?.triggerAlert?.({
          message: errorMessage,
          severity: 'error'
        })
        return {
          ...updatedData,
          validationStatus: 'error',
          validationMsg: errorMessage
        }
      } finally {
        setPendingUpdates((prev) => {
          const next = new Set(prev)
          next.delete(rowId)
          setIsUpdating(next.size > 0)
          return next
        })
      }
    },
    [t, updateGeneratedFuelCode]
  )

  const onCellEditingStopped = useCallback(
    async (params: any) => {
      if (params.oldValue === params.newValue) return

      const rowId = params.node.data.id
      if (pendingUpdates.has(rowId)) {
        alertRef.current?.triggerAlert?.({
          message: 'Please wait for the current update to complete.',
          severity: 'warning'
        })
        return
      }

      const pendingRow = { ...params.node.data, validationStatus: 'pending' }
      params.node.updateData(pendingRow)
      alertRef.current?.triggerAlert?.({
        message: 'Updating row...',
        severity: 'pending'
      })

      const finalRow = await updateRowWithValidation(pendingRow)
      params.node.updateData(finalRow)
      setRowData((prev) => replaceRow(prev, finalRow))
    },
    [pendingUpdates, updateRowWithValidation]
  )

  if (!rowData.length) return null

  return (
    <Box>
      <Stack spacing={1} sx={{ mb: 2 }}>
        <BCTypography variant="body2" color="text.secondary">
          {t('carbonIntensity:step5.generatedFuelCodesIntro')}
        </BCTypography>
      </Stack>

      <BCGridEditor
        gridRef={gridRef}
        alertRef={alertRef}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowData={rowData}
        onCellValueChanged={onCellValueChanged}
        onCellEditingStopped={onCellEditingStopped}
        showAddRowsButton={false}
        showMandatoryColumns={!readOnly}
        popupParent={popupParent}
        context={{ errors }}
        getRowStyle={getRowStyle}
        getRowId={(params: any) => params.data.id}
        {...gridOptions}
      />
    </Box>
  )
}
