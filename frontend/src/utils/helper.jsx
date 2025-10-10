export const normalizeYear = (value) => {
  if (value === null || value === undefined || value === '') {
    return 'N/A'
  }
  return String(value)
}

export const compareYears = (a, b) => {
  const numA = Number(a)
  const numB = Number(b)
  const isNumA = !Number.isNaN(numA)
  const isNumB = !Number.isNaN(numB)

  if (isNumA && isNumB) {
    return numA - numB
  }
  if (isNumA) return -1
  if (isNumB) return 1

  return String(a ?? '').localeCompare(String(b ?? ''), undefined, {
    sensitivity: 'base'
  })
}
