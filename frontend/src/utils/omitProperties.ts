export const omitProperties = <
  Value extends object,
  const Keys extends readonly (keyof Value)[]
>(
  value: Value,
  keys: Keys
): Omit<Value, Keys[number]> => {
  const result = { ...value }
  for (const key of keys) Reflect.deleteProperty(result, key)
  return result
}
