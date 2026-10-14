import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'

import BCTypography from '@/components/BCTypography'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import { useFuelCodeOptions } from '@/hooks/useFuelCode'
import { useUpdateCIApplicationGeneratedFuelCode } from '@/hooks/useCIApplication'
import {
  defaultColDef,
  fuelCodeColDefs,
  normalizeTransportModeDistancesForSave
} from '@/views/FuelCodes/AddFuelCode/_schema'
import type { OptionsData } from '@/types/schema'

import type { ColDef, CellValueChangedEvent, CellEditingStoppedEvent, RowClassParams, GetRowIdParams } from 'ag-grid-community'
import type { AgGridReact } from 'ag-grid-react'
import type { BCAlert2Handle } from '@/components/BCAlert/BCAlert2'
import { omitProperties } from '@/utils/omitProperties'

interface GeneratedFuelCode extends Record<string, unknown> {
  id: string
  isValid?: boolean
  validationErrors?: Record<string, unknown>
  validationMsg?: string | Record<string, unknown>
  validationStatus?: string
  modified?: boolean
}
interface ValidationDetail { loc?: string | (string | number)[]; msg?: string }
interface RequestError {
  message?: string
  response?: {data?: {errors?: {fields?: string[]; message?: string}[]; detail?: string | ValidationDetail[]}}
}
type GeneratedFuelCodesSectionProps = {
  ciApplication: {ciApplicationId?: number; generatedFuelCodes?: GeneratedFuelCode[]}
  readOnly?: boolean
}

const getValidationStatus = (row: GeneratedFuelCode) => {
  if (row?.isValid) return 'success'
  if (row?.validationErrors || row?.validationMsg) return 'error'
  return undefined
}

const toGridRow = (row: GeneratedFuelCode) => ({
  ...row,
  validationStatus: getValidationStatus(row)
})

const getValidationFields = (row: GeneratedFuelCode) =>
  Object.keys(
    row?.validationErrors ||
      (row?.validationMsg && typeof row.validationMsg === 'object'
        ? row.validationMsg
        : {})
  )

const toErrorMap = (rows: GeneratedFuelCode[]) =>
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

const toUpdatePayload = (row: GeneratedFuelCode) => {
  const rest = omitProperties(row, ['id', 'pathwayId', 'pathwayLabel', 'isValid', 'validationMsg', 'validationErrors', 'validationStatus'])
  return {
    ...rest,
    feedstockFuelTransportMode: normalizeTransportModeDistancesForSave(
      rest.feedstockFuelTransportMode
    ),
    finishedFuelTransportMode: normalizeTransportModeDistancesForSave(
      rest.finishedFuelTransportMode
    )
  }
}

const replaceRow = (rows: GeneratedFuelCode[], nextRow: GeneratedFuelCode) =>
  rows.map((row) => (row.id === nextRow.id ? nextRow : row))

const mergeIncomingRows = (currentRows: GeneratedFuelCode[], incomingRows: GeneratedFuelCode[]) => {
  const currentRowsById = new Map(currentRows.map((row) => [row.id, row]))

  return incomingRows.map((incomingRow) => {
    const currentRow = currentRowsById.get(incomingRow.id)
    return currentRow?.modified ? currentRow : incomingRow
  })
}

const formatFastApiDetail = (detail: string | ValidationDetail[] | undefined) => {
  if (!Array.isArray(detail)) return detail
  return detail
    .map((item) => {
      const loc = Array.isArray(item?.loc) ? item.loc.join('.') : item?.loc
      return [loc, item?.msg].filter(Boolean).join(': ')
    })
    .filter(Boolean)
    .join('; ')
}

const getErrorMessage = (error: unknown, fallback: string) => {
  const requestError = error as RequestError
  if (requestError?.response?.data?.errors?.[0]) {
    const { fields, message } = requestError.response.data.errors[0]
    const fieldText = fields?.length === 1 ? `${fields[0]} ` : ''
    return `Unable to save row: ${fieldText}${message}`
  }
  return (
    formatFastApiDetail(requestError?.response?.data?.detail) ||
    requestError?.message ||
    fallback
  )
}

const getErrorFields = (error: unknown) =>
  (error as RequestError)?.response?.data?.errors?.[0]?.fields || []

export const GeneratedFuelCodesSection = ({
  ciApplication,
  readOnly = false
}: GeneratedFuelCodesSectionProps) => {
  const { t } = useTranslation(['carbonIntensity'])
  const gridRef = useRef<AgGridReact<GeneratedFuelCode> | null>(null)
  const alertRef = useRef<BCAlert2Handle | null>(null)
  const ciApplicationId = ciApplication?.ciApplicationId
  const { data: fuelCodeOptions } = useFuelCodeOptions({}, {})
  const { mutateAsync: updateGeneratedFuelCode } =
    useUpdateCIApplicationGeneratedFuelCode(ciApplicationId)

  const previousCIApplicationId = useRef(ciApplicationId)
  const rowDataRef = useRef<GeneratedFuelCode[]>([])
  const [rowData, setRowData] = useState<GeneratedFuelCode[]>([])
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set())
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    const nextRows = (ciApplication?.generatedFuelCodes || []).map(toGridRow)
    const isSameApplication = previousCIApplicationId.current === ciApplicationId
    previousCIApplicationId.current = ciApplicationId

    const mergedRows = isSameApplication
      ? mergeIncomingRows(rowDataRef.current, nextRows)
      : nextRows

    rowDataRef.current = mergedRows
    setRowData(mergedRows)
    setErrors(toErrorMap(mergedRows))
  }, [ciApplication, ciApplicationId])

  const columnDefs = useMemo(() => {
    const baseDefs = fuelCodeColDefs(
      fuelCodeOptions as OptionsData | undefined,
      errors,
      false,
      !readOnly,
      false,
      true
    ).map((col: ColDef<GeneratedFuelCode>) => {
      if (col.colId === 'action') {
        return { ...col, hide: true }
      }
      return {
        ...col,
        editable: (params: RowClassParams<GeneratedFuelCode>) => {
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
    (params: RowClassParams<GeneratedFuelCode>) => {
      const isRowUpdating = pendingUpdates.has(params.data.id)
      return {
        opacity: isRowUpdating ? 0.6 : 1,
        pointerEvents: isRowUpdating ? 'none' : 'auto',
        background: isRowUpdating ? '#f5f5f5' : 'transparent'
      }
    },
    [pendingUpdates]
  )

  const onCellValueChanged = useCallback((params: CellValueChangedEvent<GeneratedFuelCode>) => {
    const updatedData = {
      ...params.data,
      modified: true
    }
    params.api.applyTransaction({ update: [updatedData] })
    setRowData((prev) => {
      const nextRows = replaceRow(prev, updatedData)
      rowDataRef.current = nextRows
      return nextRows
    })
  }, [])

  const updateRowWithValidation = useCallback(
    async (updatedData: GeneratedFuelCode) => {
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
      } catch (error) {
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
    async (params: CellEditingStoppedEvent<GeneratedFuelCode>) => {
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
      setRowData((prev) => {
        const nextRows = replaceRow(prev, finalRow)
        rowDataRef.current = nextRows
        return nextRows
      })
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
        getRowId={(params: GetRowIdParams<GeneratedFuelCode>) => params.data.id}
        {...gridOptions}
      />
    </Box>
  )
}
