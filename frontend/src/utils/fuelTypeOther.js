export const FUEL_TYPE_OTHER = 'Other'

export const fuelTypeOtherConditionalStyle = (params) => {
  // Don't override background for CREATE actions (let green row background show through)
  if (params.data.actionType === 'CREATE') {
    return {
      borderColor: isFuelTypeOther(params) ? 'unset' : undefined
    }
  }
  
  return {
    backgroundColor: isFuelTypeOther(params) ? '#fff' : '#f2f2f2',
    borderColor: isFuelTypeOther(params) ? 'unset' : undefined
  }
}

export const isFuelTypeOther = (params) => {
  return params.data?.fuelType === FUEL_TYPE_OTHER
}