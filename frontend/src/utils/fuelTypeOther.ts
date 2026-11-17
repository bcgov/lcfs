export const FUEL_TYPE_OTHER = 'Other'

interface FuelTypeOtherData {
  actionType?: string
  fuelType?: string | null
}

interface FuelTypeOtherParams {
  data?: FuelTypeOtherData | null
}

interface FuelTypeOtherCellStyle {
  backgroundColor?: string
  borderColor: string | undefined
}

export const fuelTypeOtherConditionalStyle = (
  params: FuelTypeOtherParams
): FuelTypeOtherCellStyle => {
  // Don't override background for CREATE actions (let green row background show through)
  if (params.data?.actionType === 'CREATE') {
    return {
      borderColor: isFuelTypeOther(params) ? 'unset' : undefined
    }
  }

  return {
    backgroundColor: isFuelTypeOther(params) ? '#fff' : '#f2f2f2',
    borderColor: isFuelTypeOther(params) ? 'unset' : undefined
  }
}

export const isFuelTypeOther = (params: FuelTypeOtherParams): boolean => {
  return params.data?.fuelType === FUEL_TYPE_OTHER
}
