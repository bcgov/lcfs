export const omitProperties = (value, keys) => {
  const result = { ...value }
  for (const key of keys) delete result[key]
  return result
}
