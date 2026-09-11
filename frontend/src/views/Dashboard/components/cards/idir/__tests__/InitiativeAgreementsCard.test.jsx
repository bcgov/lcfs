import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { InitiativeAgreementsCard } from '../InitiativeAgreementsCard'
import { useInitiativeAgreementCounts } from '@/hooks/useDashboard'
import { isFeatureEnabled } from '@/constants/config'
import { wrapper } from '@/tests/utils/wrapper'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/routes/routes'
import { FILTER_KEYS } from '@/constants/common'

vi.mock('@/hooks/useDashboard')
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: vi.fn()
}))
vi.mock('@/constants/config', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, isFeatureEnabled: vi.fn() }
})

vi.mock('@/components/BCWidgetCard/BCWidgetCard', () => ({
  __esModule: true,
  default: ({ title, content }) => (
    <div data-test="bc-widget-card">
      <div data-test="widget-title">{title}</div>
      <div data-test="widget-content">{content}</div>
    </div>
  )
}))

vi.mock('@/components/Loading', () => ({
  __esModule: true,
  default: ({ message }) => <div data-test="loading">{message}</div>
}))

describe('InitiativeAgreementsCard Component', () => {
  const mockNavigate = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    useNavigate.mockReturnValue(mockNavigate)
    isFeatureEnabled.mockReturnValue(true)

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

  it('renders the loading state', () => {
    useInitiativeAgreementCounts.mockReturnValue({
      data: null,
      isLoading: true
    })

    render(<InitiativeAgreementsCard />, { wrapper })
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('renders the lifecycle counts', () => {
    useInitiativeAgreementCounts.mockReturnValue({
      data: { underway: 5, draft: 2 },
      isLoading: false
    })

    render(<InitiativeAgreementsCard />, { wrapper })

    expect(screen.getByTestId('widget-title')).toHaveTextContent(
      'Initiative agreements'
    )
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(
      screen.getByText('View all initiative agreement(s)')
    ).toBeInTheDocument()
  })

  it('navigates to the grid pre-filtered to Underway', () => {
    useInitiativeAgreementCounts.mockReturnValue({
      data: { underway: 5, draft: 2 },
      isLoading: false
    })

    render(<InitiativeAgreementsCard />, { wrapper })
    fireEvent.click(screen.getByText('Initiative agreement(s) underway'))

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      FILTER_KEYS.INITIATIVE_AGREEMENTS_GRID,
      JSON.stringify({
        'lifecycleStatus.status': {
          filterType: 'text',
          type: 'equals',
          filter: 'Underway'
        }
      })
    )
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.INITIATIVE_AGREEMENTS.LIST)
  })

  it('clears the stored filter for the view-all link', () => {
    useInitiativeAgreementCounts.mockReturnValue({
      data: { underway: 5, draft: 2 },
      isLoading: false
    })

    render(<InitiativeAgreementsCard />, { wrapper })
    fireEvent.click(screen.getByText('View all initiative agreement(s)'))

    expect(window.sessionStorage.removeItem).toHaveBeenCalledWith(
      FILTER_KEYS.INITIATIVE_AGREEMENTS_GRID
    )
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.INITIATIVE_AGREEMENTS.LIST)
  })

  it('renders nothing when the module flag is off', () => {
    isFeatureEnabled.mockReturnValue(false)
    useInitiativeAgreementCounts.mockReturnValue({
      data: null,
      isLoading: false
    })

    const { container } = render(<InitiativeAgreementsCard />, { wrapper })
    expect(container).toBeEmptyDOMElement()
  })
})
