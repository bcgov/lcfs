export const normalizeFuelTypeVolumeTrendRows = (rows = []) =>
  Array.from(
    rows
      .reduce((acc, row) => {
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
