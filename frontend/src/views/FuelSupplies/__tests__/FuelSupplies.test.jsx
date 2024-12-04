import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { AddEditFuelSupplies } from '../AddEditFuelSupplies'
import * as useFuelSupplyHooks from '@/hooks/useFuelSupply'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('@react-keycloak/web', () => ({
  ReactKeycloakProvider: ({ children }) => children,
  useKeycloak: () => ({
    keycloak: {
      authenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn()
    },
    initialized: true
  })
}))

// Mock react-router-dom
const mockUseParams = vi.fn()
const mockUseLocation = vi.fn(() => ({
  state: { message: 'Test message', severity: 'info' }
}))
const mockUseNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useParams: () => ({
    complianceReportId: '123',
    compliancePeriod: '2023'
  }),
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockUseNavigate
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock hooks
vi.mock('@/hooks/useFuelSupply', () => ({
  useFuelSupplyOptions: vi.fn(() => ({
    data: { fuelTypes: [
      {
        fuelTypeId: 2,
        fuelType: 'CNG',
        fossilDerived: false,
        defaultCarbonIntensity: 63.91,
        units: 'm³',
        unrecognized: false,
      },
      {
        fuelTypeId: 3,
        fuelType: 'Electric',
        defaultCarbonIntensity: 12.14,
        units: 'kWh',
        unrecognized: false,
      },
    ] },
    isLoading: false,
    isFetched: true,
  })),
  useGetFuelSupplies: {
    data: { fuelSupplies: [
      {
        fuelSupplyId: 1,
        complianceReportId: 2,
        groupUuid: "fc44368c-ca60-4654-8f3d-32b55aa16245",
        version: 0,
        userType: "SUPPLIER",
        actionType: "CREATE",
        fuelTypeId: 3,
        fuelType: {
          fuelTypeId: 3,
          fuelType: "Electricity",
          fossilDerived: false,
          defaultCarbonIntensity: 12.14,
          units: "kWh"
        },
        fuelCategoryId: 1,
        fuelCategory: {
          fuelCategoryId: 1,
          category: "Gasoline"
        },
        endUseId: 1,
        endUseType: {
          endUseTypeId: 1,
          type: "Light duty motor vehicles"
        },
        provisionOfTheActId: 3,
        provisionOfTheAct: {
          provisionOfTheActId: 3,
          name: "Default carbon intensity - section 19 (b) (ii)"
        },
        quantity: 1000000,
        units: "kWh"
      },
      {
        fuelSupplyId: 2,
        complianceReportId: 2,
        groupUuid: "0f571126-43ae-43e7-b04b-705a22a2cbaf",
        version: 0,
        userType: "SUPPLIER",
        actionType: "CREATE",
        fuelTypeId: 3,
        fuelType: {
          fuelTypeId: 3,
          fuelType: "Electricity",
          fossilDerived: false,
          defaultCarbonIntensity: 12.14,
          units: "kWh"
        },
        fuelCategoryId: 1,
        fuelCategory: {
          fuelCategoryId: 1,
          category: "Gasoline"
        },
        endUseId: 2,
        endUseType: {
          endUseTypeId: 2,
          type: "Other or unknown"
        },
        provisionOfTheActId: 3,
        provisionOfTheAct: {
          provisionOfTheActId: 3,
          name: "Default carbon intensity - section 19 (b) (ii)"
        },
        quantity: 100000,
        units: "kWh"
      }
    ]
    ,
    pagination: {
      page: 1,
      size: 10,
      total: 2,
      totalPages: 1,
    }, },
    isLoading: false
  },
  useSaveFuelSupply: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
}));

describe('AddEditFuelSupplies', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders the component with no initial data', async () => {
    render(<AddEditFuelSupplies />, { wrapper })

    await waitFor(() => {
      expect(
        screen.getByText(/Add new supply of fuel/i)
      ).toBeInTheDocument()
    })
  })

  it('should show error for 0 quantity', async () => {
    render(<AddEditFuelSupplies />, { wrapper })

    const quantityInput = screen.getByLabelText(/quantity/i)
    fireEvent.change(quantityInput, { target: { value: '0' } })
    fireEvent.blur(quantityInput)

    await waitFor(() => {
      expect(
        screen.getByText(/quantity supplied must be greater than 0./i)
      ).toBeInTheDocument()
    })
  })

  it('should show error for empty quantity', async () => {
    render(<AddEditFuelSupplies />, { wrapper })

    const quantityInput = screen.getByLabelText(/quantity/i)
    fireEvent.change(quantityInput, { target: { value: '' } })
    fireEvent.blur(quantityInput)

    await waitFor(() => {
      expect(
        screen.getByText(/quantity supplied must be greater than 0./i)
      ).toBeInTheDocument()
    })
  })

  it('should not show error for valid quantity', async () => {
    render(<AddEditFuelSupplies />, { wrapper })

    const quantityInput = screen.getByLabelText(/quantity/i)
    fireEvent.change(quantityInput, { target: { value: '10' } })
    fireEvent.blur(quantityInput)

    await waitFor(() => {
      expect(
        screen.queryByText(/quantity supplied must be greater than 0./i)
      ).not.toBeInTheDocument()
    })
  })

  it('displays an error message when row update fails', async () => {
    const mockMutateAsync = vi.fn().mockRejectedValueOnce({
      response: {
        data: {
          errors: [{ fields: ['quantity'], message: 'Invalid quantity' }]
        }
      }
    })

    vi.mocked(useFuelSupplyHooks.useSaveFuelSupply).mockReturnValueOnce({
      mutateAsync: mockMutateAsync
    })

    render(<AddEditFuelSupplies />, { wrapper })

    const quantityInput = screen.getByLabelText(/quantity/i)
    fireEvent.change(quantityInput, { target: { value: '-5' } })
    fireEvent.blur(quantityInput)

    await waitFor(() => {
      expect(
        screen.getByText(/error updating row: invalid quantity/i)
      ).toBeInTheDocument()
    })
  })
})
