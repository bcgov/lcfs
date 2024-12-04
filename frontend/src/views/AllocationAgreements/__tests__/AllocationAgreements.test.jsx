import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { AddEditAllocationAgreements } from '../AddAllocationAgreements'
import * as useGetAllocationAgreements from '@/hooks/useAllocationAgreement'
import * as useAllocationAgreementOptions from '@/hooks/useAllocationAgreement'
import * as useSaveAllocationAgreement from '@/hooks/useAllocationAgreement'
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

// Mock useApiService
vi.mock('@/services/useApiService', () => ({
  default: vi.fn(() => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  })),
  useApiService: vi.fn(() => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }))
}))

// Mock react-router-dom
const mockUseParams = vi.fn()
const mockUseLocation = vi.fn(() => ({
  state: { message: 'Test message', severity: 'info' }
}))
const mockUseNavigate = vi.fn()
const mockHasRoles = vi.fn()

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useParams: () => ({
    complianceReportId: '123',
    compliancePeriod: '2023'
  }),
  useLocation: () => mockUseLocation,
  useNavigate: () => mockUseNavigate
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))


describe('AddEditAllocationAgreement', () => {
  const setupMocks = (overrides = {}) => {
    const defaultMocks = {
      useParams: { compliancePeriod: '2023', complianceReportId: '123' },
      useLocation: { state: {} }
    }

    const mocks = { ...defaultMocks, ...overrides }
    mockUseParams.mockReturnValue(mocks.useParams)
    mockUseLocation.mockReturnValue(mocks.useLocation)
  }

  beforeEach(() => {
    vi.resetAllMocks()
    setupMocks()

    // Reapply mocks to ensure they are correctly initialized
    vi.mock('@/hooks/useAllocationAgreement', () => ({
      useAllocationAgreementOptions: vi.fn(() => ({
        data: {
          allocationTransactionTypes: [
            {
              allocationTransactionTypeId: 1,
              type: "Purchased"
            },
            {
              allocationTransactionTypeId: 2,
              type: "Sold"
            }
          ],
          fuelTypes: [
            {
              fuelTypeId: 1,
              fuelType: "Biodiesel",
              defaultCarbonIntensity: 100.21,
              units: "L",
              unrecognized: false,
              fuelCategories: [
                {
                  fuelCategoryId: 2,
                  category: "Diesel",
                  defaultAndPrescribedCi: 100.21
                }
              ],
              fuelCodes: [
                {
                  fuelCodeId: 2,
                  fuelCode: "BCLCF124.4",
                  carbonIntensity: 3.62
                }
              ],
              provisionOfTheAct: [
                {
                  provisionOfTheActId: 2,
                  name: "Fuel code - section 19 (b) (i)"
                },
                {
                  provisionOfTheActId: 3,
                  name: "Default carbon intensity - section 19 (b) (ii)"
                }
              ]
            }
          ],
          provisionsOfTheAct: [
            {
              provisionOfTheActId: 3,
              name: "Default carbon intensity - section 19 (b) (ii)"
            }
          ],
          fuelCodes: [
            {
              fuelCodeId: 1,
              fuelCode: "BCLCF102.5",
              carbonIntensity: 37.21
            }
          ],
          unitsOfMeasure: [
            "L"
          ]
        },
        isLoading: false,
        isFetched: true
      })),
      useGetAllocationAgreements: vi.fn(() => ({
        data: { allocationAgreements: [], pagination: {} },
        isLoading: false
      })),
      useSaveAllocationAgreement: vi.fn(() => ({
        mutateAsync: vi.fn()
      }))
    }))
  })

  it('renders the component', async () => {
    render(<AddEditAllocationAgreements />, { wrapper })
    await waitFor(() => {
      expect(
        screen.getByText(/Enter allocation agreement details below/i)
      ).toBeInTheDocument()
    })
  })

  it('should show error for 0 quantity', () => {
    render(<AddEditAllocationAgreements />);
    const quantityInput = screen.getByLabelText('Quantity');
    fireEvent.change(quantityInput, { target: { value: '0' } });
    fireEvent.blur(quantityInput);
    expect(screen.getByText('Quantity must be greater than 0.')).toBeInTheDocument();
  });

  it('should show error for empty quantity', () => {
    render(<AddEditAllocationAgreements />);
    const quantityInput = screen.getByLabelText('Quantity');
    fireEvent.change(quantityInput, { target: { value: '' } });
    fireEvent.blur(quantityInput);
    expect(screen.getByText('Quantity must be greater than 0.')).toBeInTheDocument();
  });

  it('should not show error for valid quantity', () => {
    render(<AddEditAllocationAgreements />);
    const quantityInput = screen.getByLabelText('Quantity');
    fireEvent.change(quantityInput, { target: { value: '10' } });
    fireEvent.blur(quantityInput);
    expect(screen.queryByText('Quantity must be greater than 0.')).not.toBeInTheDocument();
  });
})
