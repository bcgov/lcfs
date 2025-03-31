import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { FuelCodeCard } from '../FuelCodeCard'
import { useFuelCodeCounts } from '@/hooks/useDashboard'
import { wrapper } from '@/tests/utils/wrapper'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/routes/routes'
import { FILTER_KEYS } from '@/constants/common'
import { FUEL_CODE_STATUSES } from '@/constants/statuses'

// Mock dependencies
vi.mock('@/hooks/useDashboard')
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: vi.fn()
}))

// Mock components
vi.mock('@/components/BCWidgetCard/BCWidgetCard', () => ({
  __esModule: true,
  default: ({ title, content }) => (
    <div data-testid="bc-widget-card">
      <div data-testid="widget-title">{title}</div>
      <div data-testid="widget-content">{content}</div>
    </div>
  )
}))

vi.mock('@/components/Loading', () => ({
  __esModule: true,
  default: ({ message }) => <div data-testid="loading">{message}</div>
}))

describe('FuelCodeCard Component', () => {
  const mockNavigate = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    useNavigate.mockReturnValue(mockNavigate)

    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        setItem: vi.fn(),
        getItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      writable: true
    })
  })

  it('renders loading state correctly', () => {
    useFuelCodeCounts.mockReturnValue({
      data: null,
      isLoading: true
    })

    render(<FuelCodeCard />, { wrapper })

    const loadingElement = screen.getByText(/Loading.*card/, { exact: false })
    expect(loadingElement).toBeInTheDocument()
  })

  it('renders with counts data', () => {
    useFuelCodeCounts.mockReturnValue({
      data: { draftFuelCodes: 3 },
      isLoading: false
    })

    render(<FuelCodeCard />, { wrapper })

    expect(screen.getByText('Fuel Codes')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText(/There are/)).toBeInTheDocument()
    expect(screen.getByText(/Fuel Code\(s\) in progress/)).toBeInTheDocument()
  })

  it('navigates to fuel codes page on link click with correct filter', () => {
    useFuelCodeCounts.mockReturnValue({
      data: { draftFuelCodes: 3 },
      isLoading: false
    })

    render(<FuelCodeCard />, { wrapper })

    // Find and click the link
    const link = screen.getByText(/Fuel Code\(s\) in progress/)
    fireEvent.click(link)

    // Check that sessionStorage was updated with the correct filter
    const expectedFilter = {
      status: {
        filterType: 'text',
        type: 'equals',
        filter: FUEL_CODE_STATUSES.DRAFT
      }
    }

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      FILTER_KEYS.FUEL_CODES_GRID,
      JSON.stringify(expectedFilter)
    )
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.FUEL_CODES.LIST)
  })

  it('handles zero counts correctly', () => {
    useFuelCodeCounts.mockReturnValue({
      data: { draftFuelCodes: 0 },
      isLoading: false
    })

    render(<FuelCodeCard />, { wrapper })

    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
