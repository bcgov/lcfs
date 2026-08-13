import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { CIApplicationCard } from '../CIApplicationCard'
import { useCIApplicationCounts } from '@/hooks/useDashboard'
import { wrapper } from '@/tests/utils/wrapper'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/routes/routes'
import { FILTER_KEYS } from '@/constants/common'
import { CI_APPLICATION_STATUSES } from '@/constants/statuses'

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

describe('CIApplicationCard Component', () => {
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
    useCIApplicationCounts.mockReturnValue({
      data: null,
      isLoading: true
    })

    render(<CIApplicationCard />, { wrapper })

    const loadingElement = screen.getByText(/Loading.*card/, { exact: false })
    expect(loadingElement).toBeInTheDocument()
  })

  it('renders with counts data', () => {
    useCIApplicationCounts.mockReturnValue({
      data: { inProgress: 17 },
      isLoading: false
    })

    render(<CIApplicationCard />, { wrapper })

    expect(screen.getByText('CI Applications')).toBeInTheDocument()
    expect(screen.getByText('17')).toBeInTheDocument()
    expect(screen.getByText(/There are/)).toBeInTheDocument()
    expect(
      screen.getByText(/CI Application\(s\) in progress/)
    ).toBeInTheDocument()
  })

  it('navigates to CI applications page on link click with correct filter', () => {
    useCIApplicationCounts.mockReturnValue({
      data: { inProgress: 17 },
      isLoading: false
    })

    render(<CIApplicationCard />, { wrapper })

    // Find and click the link
    const link = screen.getByText(/CI Application\(s\) in progress/)
    fireEvent.click(link)

    // Check that sessionStorage was updated with the correct filter
    const expectedFilter = {
      status: {
        filterType: 'set',
        type: 'set',
        filter: [
          CI_APPLICATION_STATUSES.SUBMITTED,
          CI_APPLICATION_STATUSES.RECOMMENDED
        ]
      }
    }

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      FILTER_KEYS.CI_APPLICATIONS_GRID,
      JSON.stringify(expectedFilter)
    )
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.CI_APPLICATIONS.LIST)
  })

  it('handles zero counts correctly', () => {
    useCIApplicationCounts.mockReturnValue({
      data: { inProgress: 0 },
      isLoading: false
    })

    render(<CIApplicationCard />, { wrapper })

    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
