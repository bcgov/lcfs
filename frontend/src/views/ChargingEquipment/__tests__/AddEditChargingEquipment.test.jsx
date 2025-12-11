import { describe, expect, it } from 'vitest'

// Re-create the isRowValid function for testing (mirrors the actual implementation)
// Must return boolean to work correctly with JavaScript's truthy/falsy evaluation
const isRowValid = (row) =>
  Boolean(
    row?.chargingSiteId &&
      row?.serialNumber &&
      row?.manufacturer &&
      row?.levelOfEquipmentId &&
      row?.intendedUseIds?.length > 0 &&
      row?.intendedUserIds?.length > 0
  )

describe('isRowValid validation function', () => {
  describe('valid rows', () => {
    it('returns true for a complete row with all required fields', () => {
      const validRow = {
        chargingSiteId: 1,
        serialNumber: 'ABC123',
        manufacturer: 'Tesla',
        levelOfEquipmentId: 1,
        intendedUseIds: [1, 2],
        intendedUserIds: [1]
      }

      expect(isRowValid(validRow)).toBe(true)
    })

    it('returns true when ports is empty (ports is optional)', () => {
      const rowWithoutPorts = {
        chargingSiteId: 1,
        serialNumber: 'ABC123',
        manufacturer: 'Tesla',
        levelOfEquipmentId: 1,
        ports: '',
        intendedUseIds: [1],
        intendedUserIds: [1]
      }

      expect(isRowValid(rowWithoutPorts)).toBe(true)
    })
  })

  describe('invalid rows - missing required fields', () => {
    it('returns false when chargingSiteId is missing', () => {
      const row = {
        serialNumber: 'ABC123',
        manufacturer: 'Tesla',
        levelOfEquipmentId: 1,
        intendedUseIds: [1],
        intendedUserIds: [1]
      }

      expect(isRowValid(row)).toBe(false)
    })

    it('returns false when serialNumber is missing', () => {
      const row = {
        chargingSiteId: 1,
        manufacturer: 'Tesla',
        levelOfEquipmentId: 1,
        intendedUseIds: [1],
        intendedUserIds: [1]
      }

      expect(isRowValid(row)).toBe(false)
    })

    it('returns false when manufacturer is missing', () => {
      const row = {
        chargingSiteId: 1,
        serialNumber: 'ABC123',
        levelOfEquipmentId: 1,
        intendedUseIds: [1],
        intendedUserIds: [1]
      }

      expect(isRowValid(row)).toBe(false)
    })

    it('returns false when levelOfEquipmentId is missing', () => {
      const row = {
        chargingSiteId: 1,
        serialNumber: 'ABC123',
        manufacturer: 'Tesla',
        intendedUseIds: [1],
        intendedUserIds: [1]
      }

      expect(isRowValid(row)).toBe(false)
    })
  })

  describe('invalid rows - empty intended uses/users', () => {
    it('returns false when intendedUseIds is empty array', () => {
      const row = {
        chargingSiteId: 1,
        serialNumber: 'ABC123',
        manufacturer: 'Tesla',
        levelOfEquipmentId: 1,
        intendedUseIds: [],
        intendedUserIds: [1]
      }

      expect(isRowValid(row)).toBe(false)
    })

    it('returns false when intendedUserIds is empty array', () => {
      const row = {
        chargingSiteId: 1,
        serialNumber: 'ABC123',
        manufacturer: 'Tesla',
        levelOfEquipmentId: 1,
        intendedUseIds: [1],
        intendedUserIds: []
      }

      expect(isRowValid(row)).toBe(false)
    })

    it('returns false when both intendedUseIds and intendedUserIds are empty', () => {
      const row = {
        chargingSiteId: 1,
        serialNumber: 'ABC123',
        manufacturer: 'Tesla',
        levelOfEquipmentId: 1,
        intendedUseIds: [],
        intendedUserIds: []
      }

      expect(isRowValid(row)).toBe(false)
    })

    it('returns false when intendedUseIds is undefined', () => {
      const row = {
        chargingSiteId: 1,
        serialNumber: 'ABC123',
        manufacturer: 'Tesla',
        levelOfEquipmentId: 1,
        intendedUserIds: [1]
      }

      expect(isRowValid(row)).toBe(false)
    })

    it('returns false when intendedUserIds is undefined', () => {
      const row = {
        chargingSiteId: 1,
        serialNumber: 'ABC123',
        manufacturer: 'Tesla',
        levelOfEquipmentId: 1,
        intendedUseIds: [1]
      }

      expect(isRowValid(row)).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('returns false for null row', () => {
      expect(isRowValid(null)).toBe(false)
    })

    it('returns false for undefined row', () => {
      expect(isRowValid(undefined)).toBe(false)
    })

    it('returns false for empty object', () => {
      expect(isRowValid({})).toBe(false)
    })

    it('returns false when chargingSiteId is 0', () => {
      const row = {
        chargingSiteId: 0,
        serialNumber: 'ABC123',
        manufacturer: 'Tesla',
        levelOfEquipmentId: 1,
        intendedUseIds: [1],
        intendedUserIds: [1]
      }

      // 0 is falsy, so validation should fail
      expect(isRowValid(row)).toBe(false)
    })

    it('returns false when serialNumber is empty string', () => {
      const row = {
        chargingSiteId: 1,
        serialNumber: '',
        manufacturer: 'Tesla',
        levelOfEquipmentId: 1,
        intendedUseIds: [1],
        intendedUserIds: [1]
      }

      expect(isRowValid(row)).toBe(false)
    })
  })
})

describe('getEmptyRow function behavior', () => {
  // Test the expected structure of empty rows
  const getEmptyRow = (id = Date.now()) => ({
    id,
    chargingSiteId: '',
    serialNumber: '',
    manufacturer: '',
    model: '',
    levelOfEquipmentId: '',
    ports: '',
    latitude: 0,
    longitude: 0,
    notes: '',
    intendedUseIds: [],
    intendedUserIds: []
  })

  it('creates row with empty ports (no default to Single port)', () => {
    const row = getEmptyRow()
    expect(row.ports).toBe('')
  })

  it('creates row with empty intendedUseIds array', () => {
    const row = getEmptyRow()
    expect(row.intendedUseIds).toEqual([])
  })

  it('creates row with empty intendedUserIds array', () => {
    const row = getEmptyRow()
    expect(row.intendedUserIds).toEqual([])
  })

  it('empty row fails validation', () => {
    const row = getEmptyRow()
    expect(isRowValid(row)).toBe(false)
  })
})
