export const handleScheduleSave = async ({
  labelPrefix,
  idField,
  updatedData,
  params,
  alertRef,
  setErrors,
  setWarnings,
  saveRow,
  t
}) => {
  try {
    setErrors({})
    setWarnings({})

    await saveRow(updatedData)
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
    const newWarnings = error.response.data.warnings
    if (newWarnings && newWarnings.length > 0) {
      setWarnings({
        [newWarnings[0].id]: newWarnings[0].fields
      })

      params.api.forEachNode((rowNode) => {
        if (rowNode.data.fuelSupplyId === newWarnings[0].id) {
          rowNode.updateData({
            ...rowNode.data,
            validationStatus: 'warning'
          })
        }
      })
    }

    const isNewRow = !updatedData[idField]
    const severity = isNewRow ? 'warning' : 'error'

    if (isNewRow) {
      setWarnings({
        [params.node.data.id]: error.response.data.errors[0].fields
      })
    } else {
      setErrors({
        [params.node.data.id]: error.response.data.errors[0].fields
      })
    }

    updatedData = {
      ...updatedData,
      validationStatus: severity
    }

    if (error.code === 'ERR_BAD_REQUEST') {
      const { fields, message } = error.response.data.errors[0]
      const fieldLabels = fields.map((field) => t(`${labelPrefix}.${field}`))
      const errMsg = `Unable to save row: ${
        fieldLabels.length === 1 ? fieldLabels[0] : ''
      } ${message}`

      alertRef.current?.triggerAlert({
        message: errMsg,
        severity
      })
    } else {
      alertRef.current?.triggerAlert({
        message: `Unable to save row: ${error.message}`,
        severity
      })
    }
  }
  return updatedData
}
