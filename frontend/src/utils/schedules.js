import { v4 as uuid } from 'uuid'

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

    const { data } = await saveRow(updatedData)
    const finalData = {
      ...updatedData,
      ...data,
      validationStatus: 'success',
      modified: false,
      id: data?.[idField] ?? updatedData.id
    }
    alertRef.current?.triggerAlert({
      message: 'Row updated successfully.',
      severity: 'success'
    })
    return finalData
  } catch (error) {
    const newWarnings = error.response.data.warnings
    if (newWarnings && newWarnings.length > 0) {
      setWarnings({
        [newWarnings[0].id]: newWarnings[0].fields
      })

      params.api.forEachNode((rowNode) => {
        if (
          rowNode.data.fuelSupplyId === newWarnings[0].id ||
          rowNode.data.notionalTransferId === newWarnings[0].id
        ) {
          rowNode.updateData({
            ...rowNode.data,
            validationStatus: 'warning'
          })
        }
      })
    }

    const isNewRow = !updatedData[idField]
    const severity = isNewRow ? 'warning' : 'error'

    // Handle HTTPException with detail field (e.g., duplicate name)
    if (error.response.data.detail) {
      alertRef.current?.triggerAlert({
        message: error.response.data.detail,
        severity
      })
    } else if (error.response.data.errors && error.response.data.errors[0]) {
      if (isNewRow) {
        setWarnings({
          [params.node.data.id]: error.response.data.errors[0].fields
        })
      } else {
        setErrors({
          [params.node.data.id]: error.response.data.errors[0].fields
        })
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
    } else {
      alertRef.current?.triggerAlert({
        message: `Unable to save row: ${error.message}`,
        severity
      })
    }

    updatedData = {
      ...updatedData,
      validationStatus: severity
    }
  }
  return updatedData
}

export const handleScheduleDelete = async (
  params,
  idField,
  saveRow,
  alertRef,
  setRowData,
  defaultRowData
) => {
  const updatedRow = { ...params.node.data, deleted: true }
  if (updatedRow[idField]) {
    try {
      await saveRow(updatedRow)
      params.api.applyTransaction({ remove: [params.node.data] })
      alertRef.current?.triggerAlert({
        message: 'Row deleted successfully.',
        severity: 'success'
      })
    } catch (error) {
      params.node.updateData({
        ...params.node.data,
        validationStatus: 'warning'
      })
      if (error.code === 'ERR_BAD_REQUEST') {
        const { fields, message } = error.response.data.errors[0]
        const errMsg = `Unable to delete/undo row: ${message}`

        alertRef.current?.triggerAlert({
          message: errMsg,
          severity: 'warning'
        })
      } else {
        alertRef.current?.triggerAlert({
          message: `Unable to delete/undo row: ${error.message}`,
          severity: 'warning'
        })
      }
      return false
    }
  }

  if (params.api.isRowDataEmpty()) {
    setTimeout(() => {
      setRowData([{ ...defaultRowData, id: uuid() }])
    }, 100)
  }
  return true
}
