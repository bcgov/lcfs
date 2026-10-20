import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import { v4 as uuid } from 'uuid'

import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import { BCGridEditor } from '@/components/BCDataGrid/BCGridEditor'

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
  designData: null,
  operatingDataFrom: '',
  operatingDataTo: '',
  fuelCodeId: null,
  proposedCi: null,
  fuelTypeId: null,
  feedstock: '',
  feedstockRegion: '',
  feedstockTransportMode: [],
  coproducts: '',
  finishedFuelTransportMode: []
})

export const ProposedFuelPathwaysStep = ({
  ciApplication,
  optionsData,
  onSave,
  onDelete,
  onValidationError,
  isSaving = false,
  readOnly = false,
  secondaryAction = null
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
  const [rowPendingDelete, setRowPendingDelete] = useState(null)

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
  const popupParent = useMemo(
    () => (typeof document === 'undefined' ? undefined : document.body),
    []
  )

  const onCellValueChanged = useCallback(
    (params) => {
      // ag-grid owns the row data (rows are added/removed via transactions);
      // mirroring edits back into React state re-syncs the grid to a stale
      // rowData prop, which drops transaction-added rows. Only the per-row
      // error state needs updating here.
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

  // ag-grid is the source of truth for rows; BCGridEditor applies the returned
  // transaction and the grid is read back via collectGridRows() on save. State
  // is NOT mirrored here — doing so adds each row twice (state + transaction).
  const onAction = useCallback((action, params) => {
    switch (action) {
      case 'add':
        return { add: [createEmptyRow()] }
      case 'duplicate':
        return { add: [{ ...params.data, id: uuid(), pathwayId: null }] }
      case 'delete': {
        setRowPendingDelete({
          id: params.data.id,
          rowIndex: params.node?.rowIndex ?? null
        })
        return null
      }
      default:
        return null
    }
  }, [])

  const handleCancelDelete = () => setRowPendingDelete(null)

  const handleConfirmDelete = () => {
    if (!rowPendingDelete) return
    const { id, rowIndex } = rowPendingDelete

    // Remove via rowData (not a transaction) so autoHeight stays in sync.
    const remaining = collectGridRows().filter((r) => r.id !== id)
    setRowData(remaining)
    setErrors((prev) => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
    setRowPendingDelete(null)

    // The trash button is gone, so restore focus manually.
    setTimeout(() => {
      const gridApi = gridRef.current?.api
      if (remaining.length && gridApi?.setFocusedCell) {
        const target = Math.min(rowIndex ?? 0, remaining.length - 1)
        gridApi.ensureIndexVisible?.(target)
        gridApi.setFocusedCell(target, 'action')
      } else {
        document.querySelector('[data-test="add-row-btn"]')?.focus()
      }
    }, 0)
  }

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
    let hasOperationalDateRangeIssue = false
    rows.forEach((row) => {
      const fieldErrors = validatePathwayRow(row, applicationTypes)
      if (fieldErrors.length) {
        newErrors[row.id] = fieldErrors
        if (
          row.designData === false &&
          (fieldErrors.includes('operatingDataFrom') ||
            fieldErrors.includes('operatingDataTo'))
        ) {
          hasOperationalDateRangeIssue = true
        }
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

      const errorRowCount = Object.keys(newErrors).length
      let message
      if (hasDateOrderIssue) {
        message = t('carbonIntensity:step2.validation.dateOrder')
      } else if (hasOperationalDateRangeIssue) {
        message = t(
          'carbonIntensity:step2.validation.operatingDateRangeRequired'
        )
      } else if (missingFields.size <= 3 && errorRowCount === 1) {
        const labels = fieldLabels([...missingFields], t)
        message = t('carbonIntensity:step2.validation.missingSpecificFields', {
          fields: labels.join(', ')
        })
      } else {
        message = t('carbonIntensity:step2.validation.incompleteRows', {
          count: errorRowCount
        })
      }
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
      <BCGridEditor
        gridRef={gridRef}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowData={rowData}
        onCellValueChanged={onCellValueChanged}
        onAction={onAction}
        popupParent={popupParent}
        showAddRowsButton={canEdit}
        context={{ errors }}
        showMandatoryColumns={canEdit}
        getRowId={(params) => params.data.id}
      />

      <Box mt={3}>
        <BCTypography variant="subtitle2" sx={{ pb: 1 }}>
          {t('carbonIntensity:step2.descriptionLabel')}
        </BCTypography>
        <BCTypography
          variant="caption"
          color="text.secondary"
          sx={{ pb: 1, display: 'block' }}
        >
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

      {/* Delete sits far right, away from the primary action (#4770). Any
          secondaryAction (e.g. Cancel) stays grouped with Save on the left. */}
      <Stack
        direction="row"
        spacing={2}
        sx={{ mt: 2 }}
        alignItems="center"
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <BCButton
            type="button"
            variant="contained"
            color="primary"
            data-test="ci-step2-save-btn"
            onClick={handleSave}
            disabled={readOnly || isSaving}
          >
            {ciApplication?.status?.status === 'Submitted'
              ? t('carbonIntensity:step2.saveSupplementalChanges')
              : t('carbonIntensity:step2.saveAndProceed')}
          </BCButton>
          {secondaryAction}
        </Stack>
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

      {rowPendingDelete && (
        <BCModal
          open={!!rowPendingDelete}
          onClose={handleCancelDelete}
          data={{
            title: t('carbonIntensity:step2.deleteRowConfirmTitle'),
            content: (
              <BCTypography variant="body2">
                {t('carbonIntensity:step2.deleteRowConfirmText')}
              </BCTypography>
            ),
            primaryButtonText: t('common:deleteBtn'),
            primaryButtonAction: handleConfirmDelete,
            primaryButtonColor: 'error',
            secondaryButtonText: t('common:cancelBtn'),
            secondaryButtonAction: handleCancelDelete
          }}
        />
      )}
    </Box>
  )
}

ProposedFuelPathwaysStep.displayName = 'ProposedFuelPathwaysStep'
