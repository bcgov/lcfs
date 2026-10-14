// Normalize reference fields returned as nested objects before sending rows
// back through the grid save/delete APIs.
export const flattenNestedFields = (row) => {
  const normalized = { ...row }
  if (
    normalized.provisionOfTheAct &&
    typeof normalized.provisionOfTheAct === 'object'
  ) {
    normalized.provisionOfTheActId =
      normalized.provisionOfTheAct.provisionOfTheActId
    normalized.provisionOfTheAct = normalized.provisionOfTheAct.name
  }
  if (normalized.fuelCode && typeof normalized.fuelCode === 'object') {
    normalized.fuelCodeId = normalized.fuelCode.fuelCodeId
    normalized.fuelCode = normalized.fuelCode.fuelCode
  }
  if (normalized.fuelType && typeof normalized.fuelType === 'object') {
    normalized.fuelType = normalized.fuelType.fuelType
  }
  if (normalized.fuelCategory && typeof normalized.fuelCategory === 'object') {
    normalized.fuelCategory =
      normalized.fuelCategory.category || normalized.fuelCategory.fuelCategory
  }
  return normalized
}
