const FUEL_TYPE_EQUIVALENTS = {
  'petroleum diesel': 'Fossil-derived diesel',
  'petroleum-based diesel': 'Fossil-derived diesel',
  'fossil derived diesel': 'Fossil-derived diesel',
  'fossil-derived diesel': 'Fossil-derived diesel',
  'petroleum gasoline': 'Fossil-derived gasoline',
  'petroleum-based gasoline': 'Fossil-derived gasoline',
  'fossil derived gasoline': 'Fossil-derived gasoline',
  'fossil-derived gasoline': 'Fossil-derived gasoline'
}

export const fuelTypeEquivalenceKey = (fuelType) =>
  String(fuelType || '')
    .trim()
    .toLowerCase()
    .replace('\u2010', '-')

export const normalizeFuelTypeForDisplay = (fuelType) =>
  FUEL_TYPE_EQUIVALENTS[fuelTypeEquivalenceKey(fuelType)] || fuelType

export const isEquivalentFossilFuelType = (fuelType) =>
  fuelTypeEquivalenceKey(fuelType) in FUEL_TYPE_EQUIVALENTS

export const normalizeFuelLabelForDisplay = (label) => {
  if (!label || typeof label !== 'string') {
    return label
  }

  const parts = label.split(' - ')
  if (parts.length < 2) {
    return normalizeFuelTypeForDisplay(label)
  }

  const fuelType = parts.pop()
  return [...parts, normalizeFuelTypeForDisplay(fuelType)].join(' - ')
}
