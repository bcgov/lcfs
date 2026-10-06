const getTransportModeName = (item: unknown, relationKey: string): string => {
  if (!item) return ''
  if (typeof item === 'string' || typeof item === 'number') {
    return item.toString()
  }
  if (typeof item !== 'object') return ''

  const record = item as Record<string, unknown>
  const snakeRelationKey = relationKey.replace(
    /[A-Z]/g,
    (letter) => `_${letter.toLowerCase()}`
  )
  const relation = record[relationKey]
  const snakeRelation = record[snakeRelationKey]
  const candidates = [
    record.transportMode,
    record.transport_mode,
    typeof relation === 'object' && relation !== null
      ? (relation as Record<string, unknown>).transportMode
      : undefined,
    typeof relation === 'object' && relation !== null
      ? (relation as Record<string, unknown>).transport_mode
      : undefined,
    typeof snakeRelation === 'object' && snakeRelation !== null
      ? (snakeRelation as Record<string, unknown>).transportMode
      : undefined,
    typeof snakeRelation === 'object' && snakeRelation !== null
      ? (snakeRelation as Record<string, unknown>).transport_mode
      : undefined
  ]
  const name = candidates.find(Boolean)
  return name == null ? '' : String(name)
}

export const formatTransportModeDistances = (
  value: unknown,
  relationKey: string
): string[] => {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string' && value.trim()
      ? value.split(',').map((item) => item.trim())
      : []

  return values
    .map((item: unknown) => {
      const mode = getTransportModeName(item, relationKey)
      if (!mode) return null
      const distance =
        typeof item === 'object' && item !== null
          ? (item as Record<string, unknown>).distance
          : null
      return distance === null || distance === undefined || distance === ''
        ? mode
        : `${mode} (${distance} km)`
    })
    .filter((value): value is string => Boolean(value))
}
