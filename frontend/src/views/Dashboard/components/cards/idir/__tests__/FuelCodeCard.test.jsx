import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { vi, describe, expect, beforeEach } from 'vitest'
import { FuelCodeCard } from '../FuelCodeCard'
import { useFuelCodeCounts } from '@/hooks/useDashboard'
import { test } from '@/tests/utils/fixtures'
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

  test('renders loading state correctly', ({ render, query, theme, i18n }) => {
    useFuelCodeCounts.mockReturnValue({
      data: null,
      isLoading: true
    })

    render(<FuelCodeCard />, [query, theme, i18n])

    const loadingElement = screen.getByText(/Loading.*card/, { exact: false })
    expect(loadingElement).toBeInTheDocument()
  })

  test('renders with counts data', ({ render, query, theme, i18n }) => {
    useFuelCodeCounts.mockReturnValue({
      data: { draftFuelCodes: 3 },
      isLoading: false
    })

    render(<FuelCodeCard />, [query, theme, i18n])

    expect(screen.getByText('Fuel Codes')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText(/There are/)).toBeInTheDocument()
    expect(screen.getByText(/Fuel Code\(s\) in progress/)).toBeInTheDocument()
  })

  test('navigates to fuel codes page on link click with correct filter', ({
    render,
    query,
    theme,
    i18n
  }) => {
    useFuelCodeCounts.mockReturnValue({
      data: { draftFuelCodes: 3 },
      isLoading: false
    })

    render(<FuelCodeCard />, [query, theme, i18n])

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

  test('handles zero counts correctly', ({ render, query, theme, i18n }) => {
    useFuelCodeCounts.mockReturnValue({
      data: { draftFuelCodes: 0 },
      isLoading: false
    })

    render(<FuelCodeCard />, [query, theme, i18n])

    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
