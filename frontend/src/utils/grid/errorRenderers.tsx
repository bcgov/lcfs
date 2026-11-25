import type { CellStyle } from 'ag-grid-community'

export interface GridErrorRow {
  id: string | number
  actionType?: string
}

interface GridErrorParams {
  data?: object
  colDef: {
    field?: string
    editable?: unknown
  }
}

export type GridErrors = Record<string, string[] | undefined>

const isEditableCallback = <TParams,>(
  value: unknown
): value is (params: TParams) => unknown => typeof value === 'function'

export const StandardCellErrors = (
  params: GridErrorParams,
  errors: GridErrors
): CellStyle => {
  const data = params.data as GridErrorRow
  const field = params.colDef.field!
  let style: CellStyle = {}
  if (errors[data.id] && errors[data.id]!.includes(field)) {
    style = { ...style, borderColor: 'red', border: '2px solid red' }
  } else {
    style = { ...style, borderColor: 'unset' }
  }

  const editable = params.colDef.editable
  const isEditable = isEditableCallback<GridErrorParams>(editable)
    ? editable.call(params.colDef, params)
    : editable

  if (isEditable) {
    style = { ...style, backgroundColor: '#fff' }
  } else {
    style = {
      ...style,
      backgroundColor: '#f2f2f2'
    }
  }
  return style
}

export const StandardCellWarningAndErrors = (
  params: GridErrorParams,
  errors: GridErrors,
  warnings?: GridErrors | null
): CellStyle => {
  const data = params.data as GridErrorRow
  const field = params.colDef.field!
  // Don't override row-level styling for CREATE actions (let green background show through)
  // But only disable interaction for actual new supplemental entries
  if (data.actionType === 'CREATE') {
    let style = StandardCellErrors(params, errors)
    // Only apply borders, not background colors
    if (warnings && warnings[data.id] && warnings[data.id]!.includes(field)) {
      style = { ...style, borderColor: '#fcba19', border: '2px solid #fcba19' }
    }
    return style
  }

  let style = StandardCellErrors(params, errors)

  if (warnings && warnings[data.id] && warnings[data.id]!.includes(field)) {
    style = { ...style, borderColor: '#fcba19', border: '2px solid #fcba19' }
  }

  return style
}

type ConditionalStyleFunction<TParams> = (
  params: TParams
) => CellStyle | null | undefined

const isConditionalStyleFunction = <TParams,>(
  value: unknown
): value is ConditionalStyleFunction<TParams> => typeof value === 'function'

export const StandardCellStyle = (
  params: GridErrorParams,
  errors: GridErrors,
  warnings?: GridErrors | null,
  conditionalStyleFn?: unknown
): CellStyle => {
  // Start with the base style from StandardCellWarningAndErrors
  let style = StandardCellWarningAndErrors(params, errors, warnings)

  // Apply additional conditional styles if provided
  if (isConditionalStyleFunction<GridErrorParams>(conditionalStyleFn)) {
    const additionalStyle = conditionalStyleFn(params)
    style = { ...style, ...additionalStyle }
  }

  return style
}
