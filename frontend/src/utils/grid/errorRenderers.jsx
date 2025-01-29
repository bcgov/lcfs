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

  if (
    params.colDef.editable ||
    (typeof params.colDef.editable === 'function' &&
      params.colDef.editable(params))
  ) {
    style = { ...style, backgroundColor: '#fff' }
  } else {
    style = {
      ...style,
      backgroundColor: '#f2f2f2',
      border: '0.5px solid #adb5bd'
    }
  }
  return style
}

export const StandardCellWarningAndErrors = (params, errors, warnings) => {
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
