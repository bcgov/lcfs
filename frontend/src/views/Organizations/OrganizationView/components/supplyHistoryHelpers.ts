type FuelVolumeTrendRow = {
  fuelType: string
  reportingYear: string | number
  fuelCategory?: string | null
  totalVolume: number
  fossilDerived?: boolean
  [key: string]: unknown
}

export const normalizeFuelTypeVolumeTrendRows = (
  rows: FuelVolumeTrendRow[] = []
): FuelVolumeTrendRow[] =>
  Array.from(
    rows
      .reduce<Map<string, FuelVolumeTrendRow>>((acc, row) => {
        const fuelType = row.fuelType
        const key = `${row.reportingYear}|${fuelType}|${row.fuelCategory || ''}`
        const existing = acc.get(key) || {
          ...row,
          fuelType,
          totalVolume: 0,
          fossilDerived: false
        }
        existing.totalVolume += row.totalVolume || 0
        existing.fossilDerived = existing.fossilDerived || row.fossilDerived
        acc.set(key, existing)
        return acc
      }, new Map())
      .values()
  )
