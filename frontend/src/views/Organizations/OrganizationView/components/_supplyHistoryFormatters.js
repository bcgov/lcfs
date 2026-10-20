import { formatNumberWithCommas } from '@/utils/formatters'

export const abbreviateNumber = (
  value,
  { unitLabel = '', prefix = '' } = {}
) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }

  const absValue = Math.abs(value)
  const thresholds = [
    { limit: 1e12, suffix: 'T' },
    { limit: 1e9, suffix: 'B' },
    { limit: 1e6, suffix: 'M' },
    { limit: 1e3, suffix: 'k' }
  ]

  let scaledValue = value
  let suffix = ''

  for (const threshold of thresholds) {
    if (absValue >= threshold.limit) {
      scaledValue = value / threshold.limit
      suffix = threshold.suffix
      break
    }
  }

  const precision =
    Math.abs(scaledValue) >= 100 ? 0 : Math.abs(scaledValue) >= 10 ? 1 : 2
  const formattedValue = Number(scaledValue.toFixed(precision))

  const unitText = unitLabel ? ` ${unitLabel}` : ''

  return `${prefix}${formattedValue}${suffix}${unitText}`.trim()
}

export const formatPlainNumber = (value, decimals = 0) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—'
  }
  return formatNumberWithCommas({ value: Number(value).toFixed(decimals) })
}

export const formatCompactAxisNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return ''
  }
  return abbreviateNumber(value)
}
