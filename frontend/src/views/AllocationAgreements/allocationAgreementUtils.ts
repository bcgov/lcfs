import type { BCGridRow } from '@/components/BCDataGrid/types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

// Normalize reference fields returned as nested objects before sending rows
// back through the grid save/delete APIs.
export const flattenNestedFields = (row: BCGridRow): BCGridRow => {
  const normalized = { ...row }
  if (normalized.provisionOfTheAct && isRecord(normalized.provisionOfTheAct)) {
    normalized.provisionOfTheActId =
      normalized.provisionOfTheAct.provisionOfTheActId
    normalized.provisionOfTheAct = normalized.provisionOfTheAct.name
  }
  if (normalized.fuelCode && isRecord(normalized.fuelCode)) {
    normalized.fuelCodeId = normalized.fuelCode.fuelCodeId
    normalized.fuelCode = normalized.fuelCode.fuelCode
  }
  if (normalized.fuelType && isRecord(normalized.fuelType)) {
    normalized.fuelType = normalized.fuelType.fuelType
  }
  if (normalized.fuelCategory && isRecord(normalized.fuelCategory)) {
    normalized.fuelCategory =
      normalized.fuelCategory.category || normalized.fuelCategory.fuelCategory
  }
  return normalized
}
