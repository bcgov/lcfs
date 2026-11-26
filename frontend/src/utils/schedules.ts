import { v4 as uuid } from 'uuid'
import type { GridErrors, GridWarnings } from '@/types/schema'

export interface ScheduleRow {
  [key: string]: unknown
  id?: string | number
  validationStatus?: string
}

export type ScheduleValidationStatus = 'success' | 'warning' | 'error'
export type ScheduleSaveResult<Row extends ScheduleRow = ScheduleRow> = Row & {
  validationStatus: ScheduleValidationStatus
  modified?: boolean
}

export interface ScheduleSaveResponse {
  data?: Partial<ScheduleRow>
}

export interface ScheduleValidationError {
  fields: string[]
  message: string
}

export interface ScheduleValidationWarning {
  id: string | number
  fields: string[]
}

export interface ScheduleSaveErrorResponse {
  detail?: string
  errors?: ScheduleValidationError[]
  warnings?: ScheduleValidationWarning[]
}

interface ScheduleFailure {
  code?: string
  message?: string
  response?: { data?: ScheduleSaveErrorResponse }
}

interface ScheduleAlert {
  message: string
  severity: ScheduleValidationStatus
}

export interface ScheduleGridNode<Row extends ScheduleRow = ScheduleRow> {
  data: Row
  rowIndex?: number | null
  updateData?: (data: ScheduleRow) => void
}

export interface ScheduleGridApi<Row extends ScheduleRow = ScheduleRow> {
  forEachNode?: (callback: (node: ScheduleGridNode<Row>) => void) => void
  applyTransaction?: (transaction: { remove: Row[] }) => unknown
  isRowDataEmpty?: () => boolean
  startEditingCell?: (params: {
    rowIndex: number | null | undefined
    colKey: string
  }) => void
}

export interface ScheduleGridParams<Row extends ScheduleRow = ScheduleRow> {
  node: ScheduleGridNode<Row>
  api: ScheduleGridApi<Row>
}

interface ScheduleAlertRef {
  current?: { triggerAlert: (alert: ScheduleAlert) => void } | null
}

export interface ScheduleSaveParams<Row extends ScheduleRow> {
  node?: ScheduleGridNode<Row>
  api?: ScheduleGridApi<Row>
}

interface ScheduleSaveOptions<Row extends ScheduleRow> {
  labelPrefix: string
  idField: string
  updatedData: Row
  params: ScheduleSaveParams<Row>
  alertRef: ScheduleAlertRef
  setErrors: (errors: GridErrors) => void
  setWarnings: (warnings: GridWarnings) => void
  saveRow: (row: Row) => Promise<ScheduleSaveResponse>
  t: (key: string, options: { defaultValue: string }) => string
}

const isScheduleFailure = (error: unknown): error is ScheduleFailure =>
  typeof error === 'object' && error !== null

export const handleScheduleSave = async <Row extends ScheduleRow>({
  labelPrefix,
  idField,
  updatedData,
  params,
  alertRef,
  setErrors,
  setWarnings,
  saveRow,
  t
}: ScheduleSaveOptions<Row>): Promise<ScheduleSaveResult<Row>> => {
  try {
    setErrors({})
    setWarnings({})

    const response = await saveRow(updatedData)
    const data = response?.data
    const finalData: ScheduleSaveResult<Row> = {
      ...updatedData,
      ...(data || {}),
      validationStatus: 'success',
      modified: false
    }
    alertRef.current?.triggerAlert({
      message: 'Row updated successfully.',
      severity: 'success'
    })
    return finalData
  } catch (error: unknown) {
    const failure: ScheduleFailure = isScheduleFailure(error) ? error : {}
    const responseData = failure.response?.data
    const newWarnings = responseData?.warnings
    if (newWarnings && newWarnings.length > 0) {
      setWarnings({
        [newWarnings[0].id]: newWarnings[0].fields
      })

      params.api!.forEachNode!((rowNode) => {
        if (
          rowNode.data.fuelSupplyId === newWarnings[0].id ||
          rowNode.data.notionalTransferId === newWarnings[0].id
        ) {
          rowNode.updateData!({
            ...rowNode.data,
            validationStatus: 'warning'
          })
        }
      })
    }

    const isNewRow = !updatedData[idField]
    const severity = isNewRow ? 'warning' : 'error'

    if (responseData?.detail) {
      alertRef.current?.triggerAlert({
        message: responseData.detail,
        severity
      })
    } else if (responseData?.errors && responseData.errors[0]) {
      if (isNewRow) {
        setWarnings({
          [String(params.node!.data.id)]: responseData.errors[0].fields
        })
      } else {
        setErrors({
          [String(params.node!.data.id)]: responseData.errors[0].fields
        })
      }

      if (failure.code === 'ERR_BAD_REQUEST') {
        const { fields, message } = responseData.errors[0]
        const fieldLabels = fields.map((field) => {
          const fieldParts = field.split('.')
          const lastPart = fieldParts[fieldParts.length - 1]
          const fullTranslation = t(`${labelPrefix}.${field}`, {
            defaultValue: ''
          })
          if (fullTranslation) return fullTranslation
          const partialTranslation = t(`${labelPrefix}.${lastPart}`, {
            defaultValue: ''
          })
          if (partialTranslation) return partialTranslation
          return lastPart
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (str) => str.toUpperCase())
        })
        const errMsg = `Unable to save row: ${
          fieldLabels.length === 1 ? fieldLabels[0] : ''
        } ${message}`

        alertRef.current?.triggerAlert({
          message: errMsg,
          severity
        })
      } else {
        alertRef.current?.triggerAlert({
          message: `Unable to save row: ${failure.message}`,
          severity
        })
      }
    } else {
      alertRef.current?.triggerAlert({
        message: `Unable to save row: ${failure.message}`,
        severity
      })
    }

    return {
      ...updatedData,
      validationStatus: severity
    }
  }
}

export const handleScheduleDelete = async <Row extends ScheduleRow>(
  params: ScheduleGridParams<Row>,
  idField: string,
  saveRow: (row: Row) => Promise<unknown>,
  alertRef: ScheduleAlertRef,
  setRowData: (rows: ScheduleRow[]) => void,
  defaultRowData: ScheduleRow,
  firstEditableColumn: string | null = null
): Promise<boolean> => {
  const updatedRow = { ...params.node.data, deleted: true }

  if (updatedRow[idField]) {
    try {
      await saveRow(updatedRow)
      params.api.applyTransaction?.({ remove: [params.node.data] })
      alertRef.current?.triggerAlert({
        message: 'Row deleted successfully.',
        severity: 'success'
      })
    } catch (error: unknown) {
      params.node.updateData!({
        ...params.node.data,
        validationStatus: 'warning'
      })
      const failure: ScheduleFailure = isScheduleFailure(error) ? error : {}
      if (failure.code === 'ERR_BAD_REQUEST') {
        const { message } = failure.response!.data!.errors![0]
        const errMsg = `Unable to delete/undo row: ${message}`

        alertRef.current?.triggerAlert({
          message: errMsg,
          severity: 'warning'
        })
      } else {
        alertRef.current?.triggerAlert({
          message: `Unable to delete/undo row: ${failure.message}`,
          severity: 'warning'
        })
      }
      return false
    }
  } else {
    const currentRowId = params.node.data.id
    const clearedRowData: ScheduleRow = {
      ...defaultRowData,
      id: currentRowId,
      validationStatus: undefined
    }
    params.node.updateData!(clearedRowData)
    if (firstEditableColumn) {
      setTimeout(() => {
        const rowIndex = params.node.rowIndex
        params.api.startEditingCell?.({
          rowIndex,
          colKey: firstEditableColumn
        })
      }, 50)
    }
  }

  if (params.api.isRowDataEmpty?.()) {
    setTimeout(() => {
      setRowData([{ ...defaultRowData, id: uuid() }])
    }, 100)
  }
  return true
}
