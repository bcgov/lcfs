export const FUEL_TYPE_OTHER = 'Other'

export const fuelTypeOtherConditionalStyle = (params) => ({
  backgroundColor: isFuelTypeOther(params) ? '#fff' : '#f2f2f2',
  borderColor: isFuelTypeOther(params) ? 'unset' : undefined
})

export const isFuelTypeOther = (params) => {
  return params.data?.fuelType === FUEL_TYPE_OTHER
}