import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { AddEditChargingEquipment } from '../AddEditChargingEquipment'

// Mock hooks
vi.mock('@/hooks/useChargingEquipment')
vi.mock('@/hooks/useCurrentUser')

const mockNavigate = vi.fn()
let mockLocationState = null

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      pathname: '/compliance-reporting/fse/1/edit',
      state: mockLocationState
    }),
    useParams: () => ({ fseId: '1' })
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('@/components/BCDataGrid/BCGridEditor', () => ({
  BCGridEditor: React.forwardRef(({ saveButtonProps }, ref) => (
    <div data-test="bc-grid-editor" ref={ref}>
      <button data-test="save-return-btn" onClick={saveButtonProps?.onSave}>
        {saveButtonProps?.text || 'Save'}
      </button>
    </div>
  ))
}))

const TestWrapper = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  )
}

describe('AddEditChargingEquipment - Navigation', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockLocationState = null

    const { useCurrentUser } = await import('@/hooks/useCurrentUser')
    const {
      useGetChargingEquipment,
      useCreateChargingEquipment,
      useUpdateChargingEquipment,
      useDeleteChargingEquipment,
      useChargingEquipmentMetadata,
      useChargingSites,
      useOrganizations,
      useHasAllocationAgreements
    } = await import('@/hooks/useChargingEquipment')

    useCurrentUser.mockReturnValue({
      data: { userId: 1 },
      hasAnyRole: vi.fn(() => false)
    })

    useGetChargingEquipment.mockReturnValue({
      data: {
        chargingEquipmentId: 1,
        status: 'Draft',
        chargingSiteId: '123',
        serialNumber: 'SN001'
      },
      isLoading: false,
      isError: false
    })

    useChargingEquipmentMetadata.mockReturnValue({
      statuses: [],
      levels: [],
      endUseTypes: [],
      endUserTypes: [],
      isLoading: false
    })

    useChargingSites.mockReturnValue({ data: [], isLoading: false })
    useOrganizations.mockReturnValue({ data: [], isLoading: false })
    useHasAllocationAgreements.mockReturnValue({ data: false })
    useCreateChargingEquipment.mockReturnValue({ mutateAsync: vi.fn() })
    useUpdateChargingEquipment.mockReturnValue({ mutateAsync: vi.fn() })
    useDeleteChargingEquipment.mockReturnValue({ mutateAsync: vi.fn() })
  })

  it('navigates to default Manage FSE page when no returnTo state', () => {
    mockLocationState = null

    render(
      <TestWrapper>
        <AddEditChargingEquipment />
      </TestWrapper>
    )

    const saveBtn = screen.getByTestId('save-return-btn')
    fireEvent.click(saveBtn)
    expect(mockNavigate).toHaveBeenCalledWith('/compliance-reporting/fse')
  })

  it('navigates back to Charging Site when returnTo state is set', () => {
    mockLocationState = { returnTo: '/compliance-reporting/charging-sites/123' }

    render(
      <TestWrapper>
        <AddEditChargingEquipment />
      </TestWrapper>
    )

    const saveBtn = screen.getByTestId('save-return-btn')
    fireEvent.click(saveBtn)
    expect(mockNavigate).toHaveBeenCalledWith(
      '/compliance-reporting/charging-sites/123'
    )
  })

  it('navigates back to FSE Processing when returnTo state is set', () => {
    mockLocationState = { returnTo: '/charging-sites/456/equipment-processing' }

    render(
      <TestWrapper>
        <AddEditChargingEquipment />
      </TestWrapper>
    )

    const saveBtn = screen.getByTestId('save-return-btn')
    fireEvent.click(saveBtn)
    expect(mockNavigate).toHaveBeenCalledWith(
      '/charging-sites/456/equipment-processing'
    )
  })

  it('navigates back to Manage FSE when returnTo matches FSE list', () => {
    mockLocationState = { returnTo: '/compliance-reporting/fse' }

    render(
      <TestWrapper>
        <AddEditChargingEquipment />
      </TestWrapper>
    )

    const saveBtn = screen.getByTestId('save-return-btn')
    fireEvent.click(saveBtn)
    expect(mockNavigate).toHaveBeenCalledWith('/compliance-reporting/fse')
  })
})
