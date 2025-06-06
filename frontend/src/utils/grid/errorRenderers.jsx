export const StandardCellErrors = (params, errors) => {
  let style = {}
  if (
    errors[params.data.id] &&
    errors[params.data.id].includes(params.colDef.field)
  ) {
    style = { ...style, borderColor: 'red', border: '2px solid red' }
  } else {
    style = { ...style, borderColor: 'unset' }
  }

  // For CREATE actions, use the row-level green background but add disabled styling
  if (params.data.actionType === 'CREATE') {
    // Add a subtle overlay to indicate the cells are disabled while preserving green background
    style = {
      ...style,
      backgroundColor: 'rgba(0, 0, 0, 0.05)', // Very light overlay to show disabled state
      pointerEvents: 'none', // Disable click interactions
      cursor: 'not-allowed' // Show disabled cursor
    }
    return style
  }

  const isEditable =
    typeof params.colDef.editable === 'function'
      ? params.colDef.editable(params)
      : params.colDef.editable

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
  params,
  errors,
  warnings,
  isSupplemental = false
) => {
  // Don't override row-level styling for CREATE actions (let green background show through)
  if (params.data.actionType === 'CREATE') {
    let style = StandardCellErrors(params, errors)
    // Only apply borders, not background colors
    if (
      warnings &&
      warnings[params.data.id] &&
      warnings[params.data.id].includes(params.colDef.field)
    ) {
      style = { ...style, borderColor: '#fcba19', border: '2px solid #fcba19' }
    }
    return style
  }

  let style = StandardCellErrors(params, errors)

  if (
    warnings &&
    warnings[params.data.id] &&
    warnings[params.data.id].includes(params.colDef.field)
  ) {
    style = { ...style, borderColor: '#fcba19', border: '2px solid #fcba19' }
  }

  return style
}

export const StandardCellStyle = (
  params,
  errors,
  warnings,
  conditionalStyleFn
) => {
  // Start with the base style from StandardCellWarningAndErrors
  let style = StandardCellWarningAndErrors(params, errors, warnings)

  // Apply additional conditional styles if provided
  if (conditionalStyleFn && typeof conditionalStyleFn === 'function') {
    const additionalStyle = conditionalStyleFn(params)
    style = { ...style, ...additionalStyle }
  }

  return style
}
