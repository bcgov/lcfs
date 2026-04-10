import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChargingSiteCard } from '../../components/ChargingSiteCard'
import { wrapper } from '@/tests/utils/wrapper.jsx'

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

  it('renders profile view by default', () => {
    render(<ChargingSiteCard {...mockProps} />, { wrapper })

    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Map')).toBeInTheDocument()
    expect(screen.queryByText('Edit Form')).not.toBeInTheDocument()
  })

  it('shows edit button for draft status', () => {
    render(<ChargingSiteCard {...mockProps} />, { wrapper })
    expect(screen.getByText('common:editBtn')).toBeInTheDocument()
  })

  it('does not show edit button for non-draft status', () => {
    const propsWithSubmittedStatus = {
      ...mockProps,
      data: { ...mockData, status: { status: 'Submitted' } }
    }
    render(<ChargingSiteCard {...propsWithSubmittedStatus} />, { wrapper })
    expect(screen.queryByText('common:editBtn')).not.toBeInTheDocument()
  })

  it('switches to edit mode when edit button is clicked', () => {
    render(<ChargingSiteCard {...mockProps} />, { wrapper })

    const editButton = screen.getByText('common:editBtn')
    fireEvent.click(editButton)

    expect(screen.getByText('Edit Form')).toBeInTheDocument()
    expect(screen.queryByText('Profile')).not.toBeInTheDocument()
    expect(screen.queryByText('Map')).not.toBeInTheDocument()
  })

  it('renders in add mode', () => {
    const addModeProps = { ...mockProps, addMode: true }
    render(<ChargingSiteCard {...addModeProps} />, { wrapper })

    expect(screen.getByText('Edit Form')).toBeInTheDocument()
    expect(screen.queryByText('Profile')).not.toBeInTheDocument()
  })

  it('renders history toggle and notifies on change', () => {
    render(<ChargingSiteCard {...mockProps} />, { wrapper })

    const toggle = screen.getByRole('checkbox', {
      name: 'historyToggle'
    })
    fireEvent.click(toggle)

    expect(mockProps.onHistoryModeChange).toHaveBeenCalledWith(true)
  })

  it('renders site history in read-only mode without edit button', () => {
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

    render(<ChargingSiteCard {...historyProps} />, { wrapper })

    expect(screen.queryByText('common:editBtn')).not.toBeInTheDocument()
    expect(screen.getByText('History Profile 3')).toBeInTheDocument()
    expect(screen.getByText('History Profile 2')).toBeInTheDocument()
  })

  it('applies a max-height card layout with scrollable content', () => {
    const { container } = render(<ChargingSiteCard {...mockProps} />, { wrapper })

    const card = container.querySelector('[data-testid="widget-card"]')
    const sx = JSON.parse(card.getAttribute('data-sx'))
    expect(sx.maxHeight).toBe(640)
    expect(sx['& .MuiCardContent-root'].overflowY).toBe('auto')
  })
})
