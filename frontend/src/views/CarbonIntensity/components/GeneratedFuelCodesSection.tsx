import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Box, Stack } from '@mui/material'

import BCAlert from '@/components/BCAlert'
import BCTypography from '@/components/BCTypography'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import { useFuelCodeOptions } from '@/hooks/useFuelCode'
import { useUpdateCIApplicationGeneratedFuelCode } from '@/hooks/useCIApplication'
import {
  defaultColDef,
  fuelCodeColDefs
} from '@/views/FuelCodes/AddFuelCode/_schema'

type GeneratedFuelCodesSectionProps = {
  ciApplication: any
  readOnly?: boolean
}

const getValidationStatus = (row: any) => {
  if (row?.isValid) return 'success'
  if (row?.validationMsg) return 'warning'
  return undefined
}

const toGridRow = (row: any) => ({
  ...row,
  validationStatus: getValidationStatus(row)
})

const toErrorMap = (rows: any[]) =>
  rows.reduce((acc, row) => {
    const rowErrors = Object.keys(row?.validationErrors || {})
    if (row?.id && rowErrors.length) {
      acc[row.id] = rowErrors
    }
    return acc
  }, {} as Record<string, string[]>)

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

export const GeneratedFuelCodesSection = ({
  ciApplication,
  readOnly = false
}: GeneratedFuelCodesSectionProps) => {
  const { t } = useTranslation(['carbonIntensity'])
  const gridRef = useRef<any>(null)
  const ciApplicationId = ciApplication?.ciApplicationId
  const { data: fuelCodeOptions } = useFuelCodeOptions({}, {})
  const { mutateAsync: updateGeneratedFuelCode } =
    useUpdateCIApplicationGeneratedFuelCode(ciApplicationId)

  const [rowData, setRowData] = useState<any[]>([])
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [message, setMessage] = useState<{
    severity: 'success' | 'warning' | 'error'
    text: string
  } | null>(null)

  useEffect(() => {
    const nextRows = (ciApplication?.generatedFuelCodes || []).map(toGridRow)
    setRowData(nextRows)
    setErrors(toErrorMap(nextRows))
  }, [ciApplication])

  const columnDefs = useMemo(() => {
    const baseDefs = fuelCodeColDefs(
      fuelCodeOptions,
      errors,
      false,
      !readOnly,
      false,
      true
    ).map((col: any) => {
      if (col.colId === 'action') {
        return { ...col, hide: true }
      }
      return col
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
  }, [errors, fuelCodeOptions, readOnly])

  const onCellValueChanged = useCallback((params: any) => {
    setRowData((prev) => replaceRow(prev, { ...params.data }))
  }, [])

  const onCellEditingStopped = useCallback(
    async (params: any) => {
      if (params.oldValue === params.newValue) return

      const pendingRow = { ...params.data, validationStatus: 'pending' }
      params.node.updateData(pendingRow)

      try {
        const updatedRow = await updateGeneratedFuelCode({
          generatedFuelCodeId: params.data.id,
          payload: toUpdatePayload(params.data)
        })
        const nextRow = toGridRow(updatedRow)
        params.node.updateData(nextRow)
        setRowData((prev) => replaceRow(prev, nextRow))
        setErrors((prev) => ({
          ...prev,
          [nextRow.id]: Object.keys(nextRow.validationErrors || {})
        }))
        setMessage({
          severity: nextRow.isValid ? 'success' : 'warning',
          text: nextRow.isValid
            ? t('carbonIntensity:step5.generatedFuelCodeRowSaved')
            : nextRow.validationMsg ||
              t('carbonIntensity:step5.generatedFuelCodeRowIncomplete')
        })
      } catch (error: any) {
        params.node.updateData({
          ...params.data,
          validationStatus: 'error',
          validationMsg:
            error?.response?.data?.detail ||
            error?.message ||
            'Failed to update generated fuel code.'
        })
        setMessage({
          severity: 'error',
          text:
            error?.response?.data?.detail ||
            error?.message ||
            t('carbonIntensity:step5.generatedFuelCodeRowSaveError')
        })
      }
    },
    [t, updateGeneratedFuelCode]
  )

  if (!rowData.length) return null

  return (
    <Box>
      {message && (
        <BCAlert severity={message.severity} sx={{ mb: 2 }}>
          {message.text}
        </BCAlert>
      )}

      <Stack spacing={1} sx={{ mb: 2 }}>
        <BCTypography variant="body2" color="text.secondary">
          {t('carbonIntensity:step5.generatedFuelCodesIntro')}
        </BCTypography>
      </Stack>

      <BCGridEditor
        gridRef={gridRef}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowData={rowData}
        onCellValueChanged={onCellValueChanged}
        onCellEditingStopped={onCellEditingStopped}
        showAddRowsButton={false}
        showMandatoryColumns={!readOnly}
        context={{ errors }}
        getRowId={(params: any) => params.data.id}
      />
    </Box>
  )
}
