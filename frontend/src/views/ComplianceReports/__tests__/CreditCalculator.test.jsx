import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CreditCalculator } from '../CreditCalculator'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

// Mock calculator hooks
vi.mock('@/hooks/useCalculator', () => ({
  useCalculateComplianceUnits: () => ({ data: null }),
  useGetCompliancePeriodList: () => ({
    data: { data: [{ description: '2022' }, { description: '2023' }] },
    isLoading: false
  }),
  useGetFuelTypeList: () => ({
    data: { data: [{ fuelType: 'Diesel', fuelTypeId: 1, fuelCategoryId: 1 }] },
    isLoading: false
  }),
  useGetFuelTypeOptions: () => ({
    data: {
      unit: 'L',
      eerRatios: [],
      provisions: [],
      fuelCodes: [],
      energyDensity: { unit: { name: 'MJ/L' } }
    },
    isLoading: false
  })
}))

vi.mock('@/hooks/useOrganization', () => ({
  useCurrentOrgBalance: () => ({ data: { totalBalance: 1000 } })
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: { organization: { organizationId: 1 } } })
}))

// Render helper
const renderComponent = () => render(<CreditCalculator />, { wrapper })

describe('CreditCalculator', () => {
  it('renders Clear button and formula label', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
    expect(screen.getByText(/qtySuppliedLabel/i)).toBeInTheDocument()
  })
})
