import React from 'react'
import { describe, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { ChargingSiteCard } from '../../components/ChargingSiteCard'
import { test } from '@/tests/utils/fixtures'

// Complete react-router-dom mock
vi.mock('react-router-dom', () => ({
  useParams: () => ({ siteId: '123' }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/test' })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('../../components/ChargingSiteProfile', () => ({
  ChargingSiteProfile: ({ data, historyMode }) => (
    <div data-testid="charging-site-profile">
      {historyMode ? `History Profile ${data?.version ?? ''}` : 'Profile'}
    </div>
  )
}))

vi.mock('../../components/ChargingSitesMap', () => ({
  __esModule: true,
  default: () => <div data-testid="charging-sites-map">Map</div>
}))

vi.mock('../../AddEditChargingSite', () => ({
  AddEditChargingSite: () => (
    <div data-testid="add-edit-charging-site">Edit Form</div>
  )
}))

// Mock ROUTES constant
vi.mock('@/routes/routes', () => ({
  __esModule: true,
  default: {
    REPORTS: {
      CHARGING_SITE: {
        EDIT: '/charging-sites/:siteId/edit'
      }
    }
  }
}))

// Mock roles
vi.mock('@/constants/roles', () => ({
  roles: {
    supplier: 'supplier'
  }
}))

// Mock BCWidgetCard
vi.mock('@/components/BCWidgetCard/BCWidgetCard', () => ({
  __esModule: true,
  default: ({ content, editButton, sx }) => (
    <div data-testid="widget-card" data-sx={JSON.stringify(sx)}>
      {editButton && (
        <button onClick={editButton.onClick}>{editButton.text}</button>
      )}
      {content}
    </div>
  )
}))

describe('ChargingSiteCard', () => {
  const mockData = {
    chargingSiteId: 123,
    siteName: 'Test Site',
    status: { status: 'Draft' }
  }

  const mockProps = {
    data: mockData,
    hasAnyRole: vi.fn(),
    hasRoles: vi.fn(() => true),
    isIDIR: false,
    onHistoryModeChange: vi.fn(),
    refetch: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders profile view by default', ({ render, theme, router }) => {
    render(<ChargingSiteCard {...mockProps} />, [theme, router])

    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Map')).toBeInTheDocument()
    expect(screen.queryByText('Edit Form')).not.toBeInTheDocument()
  })

  test('shows edit button for draft status', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ChargingSiteCard {...mockProps} />, [
      query,
      theme,
      localization,
      router
    ])
    expect(screen.getByText('common:editBtn')).toBeInTheDocument()
  })

  test('does not show edit button for non-draft status', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const propsWithSubmittedStatus = {
      ...mockProps,
      data: { ...mockData, status: { status: 'Submitted' } }
    }
    render(<ChargingSiteCard {...propsWithSubmittedStatus} />, [
      query,
      theme,
      localization,
      router
    ])
    expect(screen.queryByText('common:editBtn')).not.toBeInTheDocument()
  })

  test('switches to edit mode when edit button is clicked', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ChargingSiteCard {...mockProps} />, [
      query,
      theme,
      localization,
      router
    ])

    const editButton = screen.getByText('common:editBtn')
    fireEvent.click(editButton)

    expect(screen.getByText('Edit Form')).toBeInTheDocument()
    expect(screen.queryByText('Profile')).not.toBeInTheDocument()
    expect(screen.queryByText('Map')).not.toBeInTheDocument()
  })

  test('renders in add mode', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const addModeProps = { ...mockProps, addMode: true }
    render(<ChargingSiteCard {...addModeProps} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByText('Edit Form')).toBeInTheDocument()
    expect(screen.queryByText('Profile')).not.toBeInTheDocument()
  })

  test('renders history toggle and notifies on change', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ChargingSiteCard {...mockProps} />, [
      query,
      theme,
      localization,
      router
    ])

    const toggle = screen.getByRole('checkbox', {
      name: 'historyToggle'
    })
    fireEvent.click(toggle)

    expect(mockProps.onHistoryModeChange).toHaveBeenCalledWith(true)
  })

  test('renders site history in read-only mode without edit button', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const historyProps = {
      ...mockProps,
      historyMode: true,
      data: {
        ...mockData,
        history: [
          { chargingSiteId: 123, version: 3, status: { status: 'Validated' } },
          { chargingSiteId: 122, version: 2, status: { status: 'Submitted' } }
        ]
      }
    }

    render(<ChargingSiteCard {...historyProps} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.queryByText('common:editBtn')).not.toBeInTheDocument()
    expect(screen.getByText('History Profile 3')).toBeInTheDocument()
    expect(screen.getByText('History Profile 2')).toBeInTheDocument()
  })

  test('applies a max-height card layout with scrollable content', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const { container } = render(<ChargingSiteCard {...mockProps} />, [
      query,
      theme,
      localization,
      router
    ])

    const card = container.querySelector('[data-testid="widget-card"]')
    const sx = JSON.parse(card.getAttribute('data-sx'))
    expect(sx.maxHeight).toBe(640)
    expect(sx['& .MuiCardContent-root'].overflowY).toBe('auto')
  })
})
