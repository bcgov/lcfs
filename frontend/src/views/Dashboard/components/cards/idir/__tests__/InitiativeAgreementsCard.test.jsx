import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { vi, describe, expect, beforeEach } from 'vitest'
import { InitiativeAgreementsCard } from '../InitiativeAgreementsCard'
import { useInitiativeAgreementCounts } from '@/hooks/useDashboard'
import { isFeatureEnabled } from '@/constants/config'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/routes/routes'
import { FILTER_KEYS } from '@/constants/common'
import { test } from '@/tests/utils/fixtures'

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

  test('renders the loading state', ({ render, app }) => {
    useInitiativeAgreementCounts.mockReturnValue({
      data: null,
      isLoading: true
    })

    render(<InitiativeAgreementsCard />, app)
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  test('renders the lifecycle counts', ({ render, app }) => {
    useInitiativeAgreementCounts.mockReturnValue({
      data: { underway: 5, draft: 2 },
      isLoading: false
    })

    render(<InitiativeAgreementsCard />, app)

    expect(screen.getByTestId('widget-title')).toHaveTextContent(
      'Initiative agreements'
    )
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(
      screen.getByText('View all initiative agreement(s)')
    ).toBeInTheDocument()
  })

  test('navigates to the grid pre-filtered to Underway', ({ render, app }) => {
    useInitiativeAgreementCounts.mockReturnValue({
      data: { underway: 5, draft: 2 },
      isLoading: false
    })

    render(<InitiativeAgreementsCard />, app)
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

  test('clears the stored filter for the view-all link', ({ render, app }) => {
    useInitiativeAgreementCounts.mockReturnValue({
      data: { underway: 5, draft: 2 },
      isLoading: false
    })

    render(<InitiativeAgreementsCard />, app)
    fireEvent.click(screen.getByText('View all initiative agreement(s)'))

    expect(window.sessionStorage.removeItem).toHaveBeenCalledWith(
      FILTER_KEYS.INITIATIVE_AGREEMENTS_GRID
    )
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.INITIATIVE_AGREEMENTS.LIST)
  })

  test('renders nothing when the module flag is off', ({ render, app }) => {
    isFeatureEnabled.mockReturnValue(false)
    useInitiativeAgreementCounts.mockReturnValue({
      data: null,
      isLoading: false
    })

    const { container } = render(<InitiativeAgreementsCard />, app)
    expect(container).toBeEmptyDOMElement()
  })
})
