import { v4 as uuid } from 'uuid'

export const isRowValid = (row) =>
  Boolean(
    row.chargingSiteId &&
      row.serialNumber &&
      row.manufacturer &&
      row.levelOfEquipmentId &&
      row.intendedUseIds?.length > 0 &&
      row.intendedUserIds?.length > 0
  )

const parseRegistrationNumber = (value) => {
  if (typeof value !== 'string') return null

  const trimmedValue = value.trim()
  if (!trimmedValue) return null

  const match = trimmedValue.match(/^(.*?)(\d+)$/)
  if (!match) return null

  return {
    prefix: match[1],
    number: parseInt(match[2], 10),
    width: match[2].length
  }
}

export const getNextRegistrationNumber = (
  registrationNumber,
  existingRows = []
) => {
  const parsed = parseRegistrationNumber(registrationNumber)
  if (!parsed) return ''

  const { prefix, number, width } = parsed
  let maxNumber = number

  existingRows.forEach((row) => {
    const rowParsed = parseRegistrationNumber(row?.registrationNumber)
    if (rowParsed && rowParsed.prefix === prefix) {
      maxNumber = Math.max(maxNumber, rowParsed.number)
    }
  })

  const nextValue = (maxNumber + 1).toString().padStart(width, '0')
  return `${prefix}${nextValue}`
}

export const createDuplicatedBulkRow = (
  row = {},
  existingRows = [],
  idGenerator = uuid
) => {
  const duplicatedRow = {
    ...row,
    id: idGenerator(),
    serialNumber: '',
    status: 'Draft',
    registrationNumber: getNextRegistrationNumber(
      row?.registrationNumber,
      existingRows
    ),
    modified: false,
    isImportPending: false
  }

  delete duplicatedRow.chargingEquipmentId
  delete duplicatedRow.charging_equipment_id
  delete duplicatedRow.validationStatus
  delete duplicatedRow.validationMsg
  delete duplicatedRow.isNewSupplementalEntry
  delete duplicatedRow.actionType

  duplicatedRow.intendedUseIds = Array.isArray(row?.intendedUseIds)
    ? [...row.intendedUseIds]
    : []
  duplicatedRow.intendedUserIds = Array.isArray(row?.intendedUserIds)
    ? [...row.intendedUserIds]
    : []

  return duplicatedRow
}
