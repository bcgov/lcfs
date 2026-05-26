import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Stack, TextField } from '@mui/material'
import { v4 as uuid } from 'uuid'

import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'
import colors from '@/themes/base/colors'

import {
  apiToRow,
  buildPathwayColDefs,
  defaultColDef,
  fieldLabels,
  rowToApiPayload,
  validatePathwayRow
} from './_step2Schema'

const createEmptyRow = () => ({
  id: uuid(),
  pathwayId: null,
  applicationTypeId: null,
  fuelCodeTypeId: null,
  operatingDataFrom: '',
  operatingDataTo: '',
  fuelCodeId: null,
  proposedCi: null,
  fuelTypeId: null,
  feedstock: '',
  feedstockRegion: '',
  feedstockTransportMode: '',
  feedstockTransportDistance: null,
  coproducts: '',
  finishedFuelTransportMode: '',
  finishedFuelTransportDistance: null
})

export const ProposedFuelPathwaysStep = ({
  ciApplication,
  optionsData,
  onSave,
  onDelete,
  onValidationError,
  isSaving = false,
  readOnly = false
}) => {
  const { t } = useTranslation(['common', 'carbonIntensity'])
  const gridRef = useRef(null)

  const canEdit = !readOnly

  const [rowData, setRowData] = useState(() =>
    ciApplication?.pathways?.length
      ? ciApplication.pathways.map(apiToRow)
      : [createEmptyRow()]
  )
  const [description, setDescription] = useState(
    ciApplication?.pathwayDescription || ''
  )
  const [errors, setErrors] = useState({})

  // Re-seed local state when the parent reloads the application (e.g. after save)
  useEffect(() => {
    if (ciApplication?.pathways?.length) {
      setRowData(ciApplication.pathways.map(apiToRow))
    }
    setDescription(ciApplication?.pathwayDescription || '')
  }, [ciApplication])

  const columnDefs = useMemo(
    () => buildPathwayColDefs({ optionsData, canEdit }),
    [optionsData, canEdit]
  )

  const onCellValueChanged = useCallback(
    (params) => {
      setRowData((prev) =>
        prev.map((row) =>
          row.id === params.data.id ? { ...params.data } : row
        )
      )
      setErrors((prev) => {
        if (!prev[params.data.id]) return prev
        const applicationTypes = optionsData?.pathwayApplicationTypes || []
        const remaining = validatePathwayRow(params.data, applicationTypes)
        const next = { ...prev }
        if (remaining.length) {
          next[params.data.id] = remaining
        } else {
          delete next[params.data.id]
        }
        return next
      })
      params.api?.refreshCells({ rowNodes: [params.node], force: true })
    },
    [optionsData]
  )

  const onAction = useCallback(async (action, params) => {
    switch (action) {
      case 'add': {
        const newRow = createEmptyRow()
        // Mirror the grid transaction into React state — otherwise the next
        // re-render makes ag-grid re-sync to the stale rowData prop and the
        // newly-added row vanishes from the grid.
        setRowData((prev) => [...prev, newRow])
        return { add: [newRow] }
      }
      case 'duplicate': {
        const original = params.data
        const copy = { ...original, id: uuid(), pathwayId: null }
        setRowData((prev) => [...prev, copy])
        return { add: [copy] }
      }
      case 'delete':
        params.api.applyTransaction({ remove: [params.data] })
        setRowData((prev) => prev.filter((r) => r.id !== params.data.id))
        return null
      default:
        return null
    }
  }, [])

  const handleAddRow = useCallback(() => {
    const newRow = createEmptyRow()
    setRowData((prev) => [...prev, newRow])
    gridRef.current?.api?.applyTransaction({ add: [newRow] })
  }, [])

  const collectGridRows = () => {
    const rows = []
    gridRef.current?.api?.forEachNode((node) => rows.push(node.data))
    return rows.length ? rows : rowData
  }

  const handleSave = async () => {
    // Commit any open cell editor before reading row data, otherwise the
    // value the user just typed isn't yet written back to node.data and
    // validation falsely flags it as missing.
    if (typeof gridRef.current?.api?.stopEditing === 'function') {
      gridRef.current.api.stopEditing()
    }

    const rows = collectGridRows()
    const applicationTypes = optionsData?.pathwayApplicationTypes || []

    if (!rows.length) {
      const message = t('carbonIntensity:step2.validation.atLeastOneRow')
      setErrors({ _form: message })
      onValidationError?.(message)
      return
    }

    const newErrors = {}
    let hasDateOrderIssue = false
    rows.forEach((row) => {
      const fieldErrors = validatePathwayRow(row, applicationTypes)
      if (fieldErrors.length) {
        newErrors[row.id] = fieldErrors
        if (
          row.operatingDataFrom &&
          row.operatingDataTo &&
          row.operatingDataTo < row.operatingDataFrom
        ) {
          hasDateOrderIssue = true
        }
      }
    })
    if (Object.keys(newErrors).length) {
      setErrors(newErrors)
      gridRef.current?.api?.refreshCells({ force: true })

      const missingFields = new Set()
      Object.values(newErrors).forEach((fields) => {
        fields.forEach((f) => {
          // operatingDataTo can be both missing and "before from"; the dedicated
          // dateOrder copy handles the latter, so don't double-name it.
          if (!(f === 'operatingDataTo' && hasDateOrderIssue)) {
            missingFields.add(f)
          }
        })
      })
      const labels = fieldLabels([...missingFields], t)
      const message = hasDateOrderIssue
        ? t('carbonIntensity:step2.validation.dateOrder')
        : t('carbonIntensity:step2.validation.fixSpecificFields', {
            count: Object.keys(newErrors).length,
            fields: labels.join(', ')
          })
      onValidationError?.(message)
      return
    }

    setErrors({})
    await onSave?.({
      pathways: rows.map(rowToApiPayload),
      pathwayDescription: description?.trim() || null
    })
  }

  return (
    <Box>
      <BCTypography variant="h6" sx={{ pb: 2, color: colors.primary.main }}>
        {t('carbonIntensity:step2.title')}
      </BCTypography>

      <BCGridEditor
        gridRef={gridRef}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowData={rowData}
        onCellValueChanged={onCellValueChanged}
        onAction={onAction}
        showAddRowsButton={canEdit}
        onAddRows={handleAddRow}
        context={{ errors }}
        showMandatoryColumns={canEdit}
        getRowId={(params) => params.data.id}
      />

      <Box mt={3}>
        <BCTypography variant="subtitle2" sx={{ pb: 1 }}>
          {t('carbonIntensity:step2.descriptionLabel')}
        </BCTypography>
        <BCTypography variant="caption" color="text.secondary" sx={{ pb: 1, display: 'block' }}>
          {t('carbonIntensity:step2.descriptionHelp')}
        </BCTypography>
        <TextField
          multiline
          rows={4}
          fullWidth
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={readOnly}
          inputProps={{ 'data-test': 'pathwayDescription' }}
        />
      </Box>

      <Stack direction="row" spacing={2} sx={{ mt: 2 }} alignItems="center">
        <BCButton
          type="button"
          variant="contained"
          color="primary"
          data-test="ci-step2-save-btn"
          onClick={handleSave}
          disabled={readOnly || isSaving}
        >
          {t('carbonIntensity:step2.saveAndProceed')}
        </BCButton>
        {ciApplication?.ciApplicationId && onDelete && (
          <BCButton
            type="button"
            variant="outlined"
            color="error"
            data-test="ci-step2-delete-btn"
            onClick={onDelete}
            disabled={readOnly || isSaving}
          >
            {t('carbonIntensity:step1.deleteDraft')}
          </BCButton>
        )}
      </Stack>
    </Box>
  )
}

ProposedFuelPathwaysStep.displayName = 'ProposedFuelPathwaysStep'
