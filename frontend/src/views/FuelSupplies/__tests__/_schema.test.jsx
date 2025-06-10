import { describe, it, expect } from 'vitest'
import {
  PROVISION_APPROVED_FUEL_CODE,
  PROVISION_GHGENIUS,
  fuelSupplyColDefs
} from '../_schema'

describe('Fuel Supply Schema', () => {
  const mockOptionsData = {
    fuelTypes: [
      {
        fuelType: 'Test Fuel',
        fuelTypeId: 1,
        defaultCarbonIntensity: 85.5,
        provisions: [
          {
            name: PROVISION_APPROVED_FUEL_CODE,
            provisionOfTheActId: 1
          },
          {
            name: PROVISION_GHGENIUS,
            provisionOfTheActId: 2
          }
        ],
        fuelCodes: [
          {
            fuelCode: 'TEST-001',
            fuelCodeId: 1
          }
        ],
        fuelCategories: [
          {
            fuelCategory: 'Gasoline',
            defaultAndPrescribedCi: 93.67
          }
        ]
      },
      {
        fuelType: 'Other',
        fuelTypeId: 2,
        defaultCarbonIntensity: null,
        provisions: [
          {
            name: PROVISION_GHGENIUS,
            provisionOfTheActId: 2
          }
        ],
        fuelCodes: [],
        fuelCategories: [
          {
            fuelCategory: 'Gasoline',
            defaultAndPrescribedCi: 93.67
          },
          {
            fuelCategory: 'Diesel',
            defaultAndPrescribedCi: 100.21
          }
        ]
      }
    ]
  }

  const mockErrors = {}
  const mockWarnings = {}
  const isSupplemental = false

  describe('Provision of the Act Selection', () => {
    it('should clear fuel code and UCI when GHGenius is selected and reset CI to default', () => {
      const provisionColDef = fuelSupplyColDefs(
        mockOptionsData,
        mockErrors,
        mockWarnings,
        isSupplemental
      ).find((col) => col.field === 'provisionOfTheAct')

      const mockParams = {
        newValue: PROVISION_GHGENIUS,
        data: {
          fuelType: 'Test Fuel',
          fuelCode: 'TEST-001',
          fuelCodeId: 1,
          uci: 100,
          ciOfFuel: 50
        }
      }

      const result = provisionColDef.valueSetter(mockParams)

      expect(result).toBe(true)
      expect(mockParams.data.fuelCode).toBeNull()
      expect(mockParams.data.fuelCodeId).toBeNull()
      expect(mockParams.data.uci).toBeNull()
      expect(mockParams.data.ciOfFuel).toBe(85.5) // Should reset to default CI
    })

    it('should clear fuel code and CI values when approved fuel code is selected', () => {
      const provisionColDef = fuelSupplyColDefs(
        mockOptionsData,
        mockErrors,
        mockWarnings,
        isSupplemental
      ).find((col) => col.field === 'provisionOfTheAct')

      const mockParams = {
        newValue: PROVISION_APPROVED_FUEL_CODE,
        data: {
          fuelType: 'Test Fuel',
          fuelCode: 'TEST-001',
          fuelCodeId: 1,
          uci: 100,
          ciOfFuel: 50
        }
      }

      const result = provisionColDef.valueSetter(mockParams)

      expect(result).toBe(true)
      expect(mockParams.data.fuelCode).toBeNull()
      expect(mockParams.data.fuelCodeId).toBeNull()
      expect(mockParams.data.uci).toBeNull() // Should clear UCI when switching to fuel code
      expect(mockParams.data.ciOfFuel).toBeNull() // Should clear ciOfFuel when switching to fuel code
    })

    it('should reset to default CI when switching from fuel code to default provision', () => {
      const provisionColDef = fuelSupplyColDefs(
        mockOptionsData,
        mockErrors,
        mockWarnings,
        isSupplemental
      ).find((col) => col.field === 'provisionOfTheAct')

      const mockParams = {
        newValue: 'Default carbon intensity - section 19 (b) (ii)',
        data: {
          fuelType: 'Test Fuel',
          fuelCode: 'TEST-001',
          fuelCodeId: 1,
          uci: 15.5,
          ciOfFuel: 25.8
        }
      }

      const result = provisionColDef.valueSetter(mockParams)

      expect(result).toBe(true)
      expect(mockParams.data.fuelCode).toBeNull()
      expect(mockParams.data.fuelCodeId).toBeNull()
      expect(mockParams.data.uci).toBeNull()
      expect(mockParams.data.ciOfFuel).toBe(85.5) // Should reset to default CI
    })

    it('should reset to category default CI for Other fuel type when switching from fuel code', () => {
      const provisionColDef = fuelSupplyColDefs(
        mockOptionsData,
        mockErrors,
        mockWarnings,
        isSupplemental
      ).find((col) => col.field === 'provisionOfTheAct')

      const mockParams = {
        newValue: PROVISION_GHGENIUS,
        data: {
          fuelType: 'Other',
          fuelCategory: 'Diesel',
          fuelCode: 'TEST-001',
          fuelCodeId: 1,
          uci: 15.5,
          ciOfFuel: 25.8
        }
      }

      const result = provisionColDef.valueSetter(mockParams)

      expect(result).toBe(true)
      expect(mockParams.data.fuelCode).toBeNull()
      expect(mockParams.data.fuelCodeId).toBeNull()
      expect(mockParams.data.uci).toBeNull()
      expect(mockParams.data.ciOfFuel).toBe(100.21) // Should reset to category default CI
    })
  })

  describe('CI of Fuel Field', () => {
    it('should be editable when GHGenius is selected', () => {
      const ciOfFuelColDef = fuelSupplyColDefs(
        mockOptionsData,
        mockErrors,
        mockWarnings,
        isSupplemental
      ).find((col) => col.field === 'ciOfFuel')

      const mockParams = {
        data: {
          provisionOfTheAct: PROVISION_GHGENIUS
        }
      }

      expect(ciOfFuelColDef.editable(mockParams)).toBe(true)
    })

    it('should not be editable when GHGenius is not selected', () => {
      const ciOfFuelColDef = fuelSupplyColDefs(
        mockOptionsData,
        mockErrors,
        mockWarnings,
        isSupplemental
      ).find((col) => col.field === 'ciOfFuel')

      const mockParams = {
        data: {
          provisionOfTheAct: PROVISION_APPROVED_FUEL_CODE
        }
      }

      expect(ciOfFuelColDef.editable(mockParams)).toBe(false)
    })

    it('should update ciOfFuel value when edited', () => {
      const ciOfFuelColDef = fuelSupplyColDefs(
        mockOptionsData,
        mockErrors,
        mockWarnings,
        isSupplemental
      ).find((col) => col.field === 'ciOfFuel')

      const mockParams = {
        newValue: 75.5,
        data: {
          provisionOfTheAct: PROVISION_GHGENIUS,
          ciOfFuel: 50
        }
      }

      const result = ciOfFuelColDef.valueSetter(mockParams)

      expect(result).toBe(true)
      expect(mockParams.data.ciOfFuel).toBe(75.5)
    })
  })

  describe('Fuel Code Field', () => {
    it('should be editable only when approved fuel code is selected and fuel codes are available', () => {
      const fuelCodeColDef = fuelSupplyColDefs(
        mockOptionsData,
        mockErrors,
        mockWarnings,
        isSupplemental
      ).find((col) => col.field === 'fuelCode')

      const mockParams = {
        data: {
          provisionOfTheAct: PROVISION_APPROVED_FUEL_CODE,
          fuelType: 'Test Fuel' // This fuel type has fuel codes available
        }
      }

      expect(fuelCodeColDef.editable(mockParams)).toBe(true)
    })

    it('should not be editable when approved fuel code is selected but no fuel codes are available', () => {
      const fuelCodeColDef = fuelSupplyColDefs(
        mockOptionsData,
        mockErrors,
        mockWarnings,
        isSupplemental
      ).find((col) => col.field === 'fuelCode')

      const mockParams = {
        data: {
          provisionOfTheAct: PROVISION_APPROVED_FUEL_CODE,
          fuelType: 'Other Fuel' // This fuel type has no fuel codes
        }
      }

      expect(fuelCodeColDef.editable(mockParams)).toBe(false)
    })

    it('should not be editable when GHGenius is selected', () => {
      const fuelCodeColDef = fuelSupplyColDefs(
        mockOptionsData,
        mockErrors,
        mockWarnings,
        isSupplemental
      ).find((col) => col.field === 'fuelCode')

      const mockParams = {
        data: {
          provisionOfTheAct: PROVISION_GHGENIUS,
          fuelType: 'Test Fuel'
        }
      }

      expect(fuelCodeColDef.editable(mockParams)).toBe(false)
    })

    it('should auto-populate fuel code when only one is available', () => {
      const fuelCodeColDef = fuelSupplyColDefs(
        mockOptionsData,
        mockErrors,
        mockWarnings,
        isSupplemental
      ).find((col) => col.field === 'fuelCode')

      const mockParams = {
        data: {
          provisionOfTheAct: PROVISION_APPROVED_FUEL_CODE,
          fuelType: 'Test Fuel',
          fuelCode: null,
          fuelCodeId: null
        }
      }

      const value = fuelCodeColDef.valueGetter(mockParams)

      expect(value).toBe('TEST-001')
      expect(mockParams.data.fuelCodeId).toBe(1)
    })
  })
})
