import { ROLES_BADGE_SIZE } from '@/constants/common'
import dayjs from 'dayjs'

type ValueParam = { value?: unknown } | number | string | null | undefined
type FormatterParam = ValueParam | Record<string, unknown>

const hasValue = (
  obj: unknown
): obj is { value: unknown } =>
  typeof obj === 'object' &&
  obj !== null &&
  Object.prototype.hasOwnProperty.call(obj, 'value')

/**
 * Formats a number with commas and specified decimal places.
 * Optionally uses parentheses instead of a minus sign for negative numbers.
 */
export const numberFormatter = (
  params: FormatterParam,
  useParentheses: boolean = false,
  maxDecimals: number = 10
): string => {
  if (
    params == null ||
    (typeof params === 'object' && (params as { value?: unknown }).value == null)
  )
    return ''

  const value =
    (params as { value?: unknown }).value !== undefined
      ? (params as { value: unknown }).value
      : params
  const parsedValue = parseFloat(value as string)

  if (isNaN(parsedValue)) return value as string

  const absValue = Math.abs(parsedValue)
  const formattedValue = absValue.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals
  })

  if (parsedValue < 0) {
    return useParentheses ? `(${formattedValue})` : `-${formattedValue}`
  }

  return formattedValue
}

/**
 * Formats a number as currency in CAD.
 */
export const currencyFormatter = (
  params: FormatterParam,
  useParentheses: boolean = false,
  maxDecimals: number = 2
): string | unknown => {
  const cellValue = hasValue(params) ? params.value : params

  if (
    cellValue !== null &&
    (typeof cellValue === 'number' || !isNaN(Number(cellValue)))
  ) {
    const numValue = Number(cellValue)
    const absValue = Math.abs(numValue)

    const formatted = absValue.toLocaleString('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: maxDecimals,
      maximumFractionDigits: maxDecimals
    })

    if (numValue < 0) {
      return useParentheses ? `(${formatted})` : `-${formatted}`
    }

    return formatted
  }
  return cellValue
}

/**
 * Formats a number to two decimal places.
 */
export const decimalFormatter = (params: FormatterParam): string | unknown => {
  const cellValue = hasValue(params) ? params.value : params

  if (cellValue !== null && cellValue !== undefined) {
    return (cellValue as number).toLocaleString('en', {
      minimumFractionDigits: 2
    })
  }
  return cellValue
}

/**
 * Formats a date to YYYY-MM-DD format.
 */
export const dateFormatter = (params: FormatterParam): string => {
  const cellValue = hasValue(params) ? params.value : params

  if (cellValue != null) {
    const date = new Date(cellValue as string)
    return date.toISOString().split('T')[0]
  }
  return ''
}

/**
 * Formats a date to Month Day, Year format.
 * e.g. January 1, 2024
 */
export const dateToLongString = (
  dateString: string | null | undefined
): string => {
  if (!dateString) return ''
  const date = dayjs(dateString)
  return date.format('MMMM D, YYYY')
}

/**
 * Formats a phone number to (123) 456-7890 format.
 */
export const phoneNumberFormatter = (params: {
  value?: unknown
}): string => {
  const phoneNumber = params?.value?.toString().replace(/\D/g, '') || ''
  if (!phoneNumber) {
    return ''
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(
    3,
    6
  )}-${phoneNumber.slice(6)}`
}

function camelToSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

/**
 * Converts camelCase keys of an object to snake_case.
 */
export function convertObjectKeys<T = unknown>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map(convertObjectKeys) as unknown as T
  }
  return Object.keys(obj as Record<string, unknown>).reduce<
    Record<string, unknown>
  >((acc, current) => {
    const newKey = camelToSnakeCase(current)
    acc[newKey] = convertObjectKeys((obj as Record<string, unknown>)[current])
    return acc
  }, {}) as unknown as T
}

/**
 * Calculates the total value by multiplying quantity and price per unit.
 */
export const calculateTotalValue = (
  quantity: number | string,
  pricePerUnit: number | string
): number => {
  const quantityNum = parseFloat(quantity as string)
  const priceNum = parseFloat(pricePerUnit as string)
  return !isNaN(quantityNum) && !isNaN(priceNum) ? quantityNum * priceNum : 0
}

/**
 * Checks if a string represents a numeric value.
 */
export function isNumeric(str: unknown): boolean {
  if (typeof str !== 'string') return false
  return !isNaN(str as unknown as number) && !isNaN(parseFloat(str))
}

interface RoleLike {
  name: string
}

/**
 * Calculates the row height based on the width and roles.
 */
export function calculateRowHeight(
  elementWidth: number,
  roles: RoleLike[]
): number {
  const rowHeight = 42 // height of single row

  let currentRowWidth = 0
  let numRows = 1
  roles.forEach((role) => {
    const badgeSize =
      (ROLES_BADGE_SIZE as Record<string, number>)[role.name] || 0
    if (currentRowWidth !== 0 && currentRowWidth + badgeSize > elementWidth) {
      numRows++
      currentRowWidth = badgeSize
    } else {
      currentRowWidth += badgeSize
    }
  })

  return numRows * rowHeight
}

/**
 * Formats a date and time according to the Vancouver timezone.
 */
export const timezoneFormatter = ({
  value
}: {
  value: string | number | Date
}): string => {
  const date = new Date(value)
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Vancouver',
    timeZoneName: 'short'
  }

  const formattedDate = date.toLocaleString('en-CA', options)
  return formattedDate.replace(',', '').replace(/\./g, '')
}

/**
 * Inserts spaces before capital letters in a string.
 */
export const spacesFormatter = (params: {
  value: string | null | undefined
}): string | null | undefined => {
  if (params.value != null) {
    return params.value.replace(/([A-Z])/g, ' $1').trim()
  }
  return params.value
}

/**
 * Removes entries with empty string values from an object.
 */
export const cleanEmptyStringValues = <T extends Record<string, unknown>>(
  obj: T
): Partial<T> =>
  Object.entries(obj)
    .filter(([, value]) => value !== null && value !== '')
    .reduce<Record<string, unknown>>((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {}) as Partial<T>

/**
 * Formats a number with commas.
 */
export const formatNumberWithCommas = ({
  value
}: {
  value: string | number | null | undefined
}): string | number => {
  if (!value) return 0
  const [integerPart, decimalPart] = value.toString().split('.')

  let number = new Intl.NumberFormat('en-CA').format(integerPart as unknown as number)

  if (decimalPart !== undefined) {
    number = number + '.' + decimalPart
  }

  return number
}

/**
 * Formats a number with commas and a fixed number of decimal places.
 */
export const formatNumberWithDecimals = (
  { value }: { value: string | number | null | undefined },
  decimals: number = 2
): string => {
  if (value == null || value === '') return ''
  const num = Number(value)
  if (!Number.isFinite(num)) return ''
  return new Intl.NumberFormat('en-CA', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num)
}

/**
 * Removes commas from a formatted number string.
 */
export const formatNumberWithoutCommas = (
  value: string
): number | undefined => {
  const [integerPart, decimalPart] = value.split('.')

  let number = integerPart.replace(/,/g, '')

  const regex = /^\d*.?\d*$/
  if (!regex.test(number)) return

  if (decimalPart !== undefined) {
    if (!regex.test(decimalPart)) return
    number = number + '.' + decimalPart
  }

  return Number(number)
}

/**
 * Takes a date string and returns the full formatted date with timestamp and timezone
 */
export const formatDateWithTimezoneAbbr = (
  dateInput: string | number | Date
): string => {
  const time = dayjs(dateInput)
  const formattedDate = time.format('LLL')

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZoneName: 'short'
  })
  const parts = formatter.formatToParts(time.toDate())
  const timeZoneName =
    parts.find((part) => part.type === 'timeZoneName')?.value ?? ''

  return `${formattedDate} ${timeZoneName}`
}
