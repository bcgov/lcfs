import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  isEligibleRenewableFuel,
  isFuelCodeCanadian,
  calculateRenewableClaimColumnVisibility,
  applyRenewableClaimColumnVisibility
} from '../renewableClaimEligibility'

const APPROVED_FUEL_CODE = 'Fuel code - section 19 (b) (i)'

const mockOptionsData = {
  fuelTypes: [
    {
      fuelType: 'Biodiesel',
      renewable: true,
      fuelCodes: [
        {
          fuelCode: '123',
          fuelProductionFacilityCountry: 'Canada'
        },
        {
          fuelCode: '999',
          fuelProductionFacilityCountry: 'United States'
        }
      ]
    }
  ]
}

describe('renewableClaimEligibility utilities', () => {
  describe('isEligibleRenewableFuel', () => {
    it('returns true for renewable diesel types', () => {
      expect(
        isEligibleRenewableFuel('Biodiesel', 'Diesel', mockOptionsData)
      ).toBe(true)
    })

    it('returns false for non-eligible categories', () => {
      expect(
        isEligibleRenewableFuel('Biodiesel', 'Jet fuel', mockOptionsData)
      ).toBe(false)
    })
  })

  describe('isFuelCodeCanadian', () => {
    it('returns true when fuel code matches Canadian production', () => {
      expect(
        isFuelCodeCanadian('Biodiesel', 'C-123', mockOptionsData)
      ).toBe(true)
    })

    it('returns false when production country is not Canadian', () => {
      expect(
        isFuelCodeCanadian('Biodiesel', 'C-999', mockOptionsData)
      ).toBe(false)
    })
  })

  describe('calculateRenewableClaimColumnVisibility', () => {
    it('returns false visibility before 2025', () => {
      const result = calculateRenewableClaimColumnVisibility(
        [
          {
            fuelType: 'Biodiesel',
            fuelCategory: 'Diesel',
            provisionOfTheAct: 'Default carbon intensity - section 19 (b) (ii)',
            fuelCode: 'C-123'
          }
        ],
        mockOptionsData,
        '2024',
        APPROVED_FUEL_CODE
      )

      expect(result).toEqual({
        shouldShowIsCanadaProduced: false,
        shouldShowIsQ1Supplied: false
      })
    })

    it('shows Canada column for default CI or Canadian production in 2025', () => {
      const result = calculateRenewableClaimColumnVisibility(
        [
          {
            fuelType: 'Biodiesel',
            fuelCategory: 'Diesel',
            provisionOfTheAct: 'Default carbon intensity - section 19 (b) (ii)',
            fuelCode: 'C-123'
          }
        ],
        mockOptionsData,
        '2025',
        APPROVED_FUEL_CODE
      )

      expect(result.shouldShowIsCanadaProduced).toBe(true)
      expect(result.shouldShowIsQ1Supplied).toBe(false)
    })

    it('shows Q1 column for approved fuel code supplied outside Canada in 2025', () => {
      const result = calculateRenewableClaimColumnVisibility(
        [
          {
            fuelType: 'Biodiesel',
            fuelCategory: 'Diesel',
            provisionOfTheAct: APPROVED_FUEL_CODE,
            fuelCode: 'C-999'
          }
        ],
        mockOptionsData,
        '2025',
        APPROVED_FUEL_CODE
      )

      expect(result.shouldShowIsCanadaProduced).toBe(false)
      expect(result.shouldShowIsQ1Supplied).toBe(true)
    })
  })

  describe('applyRenewableClaimColumnVisibility', () => {
    const columnVisibilityState = {
      isCanadaProduced: false,
      isQ1Supplied: false
    }

    let setColumnsVisible
    let getColumn
    let gridRef

    beforeEach(() => {
      columnVisibilityState.isCanadaProduced = false
      columnVisibilityState.isQ1Supplied = false

      setColumnsVisible = vi.fn((columns, visible) => {
        columns.forEach((column) => {
          columnVisibilityState[column] = visible
        })
      })

      getColumn = vi.fn((column) => ({
        isVisible: () => columnVisibilityState[column]
      }))

      gridRef = {
        current: {
          api: {
            setColumnsVisible,
            getColumn
          }
        }
      }
    })

    it('updates visibility when values change', () => {
      applyRenewableClaimColumnVisibility(gridRef, {
        shouldShowIsCanadaProduced: true,
        shouldShowIsQ1Supplied: false
      })

      expect(setColumnsVisible).toHaveBeenCalledWith(
        ['isCanadaProduced'],
        true
      )
      expect(columnVisibilityState.isCanadaProduced).toBe(true)

      applyRenewableClaimColumnVisibility(gridRef, {
        shouldShowIsCanadaProduced: true,
        shouldShowIsQ1Supplied: true
      })

      expect(setColumnsVisible).toHaveBeenCalledWith(
        ['isQ1Supplied'],
        true
      )
      expect(columnVisibilityState.isQ1Supplied).toBe(true)
    })

    it('does not call grid API when visibility is unchanged', () => {
      columnVisibilityState.isCanadaProduced = true
      columnVisibilityState.isQ1Supplied = true

      applyRenewableClaimColumnVisibility(gridRef, {
        shouldShowIsCanadaProduced: true,
        shouldShowIsQ1Supplied: true
      })

      expect(setColumnsVisible).not.toHaveBeenCalled()
    })
  })
})
