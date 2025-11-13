import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CreditTradingMarket } from '../CreditTradingMarket'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('@/hooks/useCurrentUser')

// Mock child components
vi.mock('../CreditMarketTable', () => ({
  CreditMarketTable: React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      refreshListings: vi.fn()
    }))

    return (
      <div data-test="credit-market-table" ref={ref}>
        Credit Market Table
        {props.onRowSelect && (
          <button
            onClick={() =>
              props.onRowSelect({
                organizationId: 1,
                organizationName: 'Org'
              })
            }
          >
            Select Row
          </button>
        )}
      </div>
    )
  })
}))

vi.mock('../CreditMarketAccordion', () => ({
  CreditMarketAccordion: () => <div data-test="credit-market-accordion">Credit Market Accordion</div>
}))

vi.mock('../CreditMarketDetailsCard', () => ({
  CreditMarketDetailsCard: ({ organizationId }) => (
    <div data-test="credit-market-details-card">Details Card {organizationId}</div>
  )
}))

vi.mock('@/components/ClearFiltersButton', () => ({
  ClearFiltersButton: ({ onClick }) => (
    <button data-test="clear-filters-button" onClick={onClick}>
      Clear Filters Button
    </button>
  )
}))

// Mock BCTypography component
vi.mock('@/components/BCTypography', () => ({
  default: ({ children, variant, mb, color, sx }) => (
    <div 
      data-test="bc-typography" 
      data-variant={variant}
      data-mb={mb}
      data-color={color}
      data-sx={sx ? JSON.stringify(sx) : undefined}
    >
      {children}
    </div>
  )
}))

// Mock useTranslation hook
const mockT = vi.fn((key) => `translated-${key}`)
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: mockT
  }))
}))

describe('CreditTradingMarket', () => {
  const mockHasAnyRole = vi.fn(() => false)
  const mockUser = {
    organization: {
      organizationId: 42,
      name: 'User Organization'
    }
  }

  beforeEach(() => {
    mockHasAnyRole.mockReset()
    vi.mocked(useCurrentUser).mockReturnValue({
      data: mockUser,
      hasAnyRole: mockHasAnyRole
    })
  })

  const renderComponent = () =>
    render(<CreditTradingMarket />, { wrapper })

  it('renders without crashing', () => {
    renderComponent()
    expect(screen.getByTestId('credit-market-table')).toBeInTheDocument()
    expect(screen.getByTestId('credit-market-accordion')).toBeInTheDocument()
  })

  it('calls useTranslation with creditMarket namespace', async () => {
    const { useTranslation } = await import('react-i18next')
    renderComponent()
    expect(vi.mocked(useTranslation)).toHaveBeenCalledWith(['creditMarket'])
  })

  it('renders disclaimer with correct translation key', () => {
    renderComponent()
    expect(mockT).toHaveBeenCalledWith('creditMarket:marketDisclaimer')
    expect(screen.getByText('translated-creditMarket:marketDisclaimer')).toBeInTheDocument()
  })

  it('renders CreditMarketTable component', () => {
    renderComponent()
    expect(screen.getByTestId('credit-market-table')).toBeInTheDocument()
    expect(screen.getByText('Credit Market Table')).toBeInTheDocument()
  })

  it('renders CreditMarketAccordion component', () => {
    renderComponent()
    expect(screen.getByTestId('credit-market-accordion')).toBeInTheDocument()
    expect(screen.getByText('Credit Market Accordion')).toBeInTheDocument()
  })

  it('renders with correct component structure', () => {
    renderComponent()
    
    // Check that heading has correct styling properties
    const headings = screen.getAllByTestId('bc-typography')
    const mainHeading = headings.find(el => el.getAttribute('data-variant') === 'h4')
    const disclaimer = headings.find(el => el.getAttribute('data-variant') === 'body2')
    
    expect(disclaimer).toBeInTheDocument()
    expect(disclaimer).toHaveAttribute('data-color', 'text.secondary')
    expect(disclaimer).toHaveAttribute('data-mb', '3')
  })

  it('renders all required elements in correct order', () => {
    renderComponent()
    
    const disclaimerText = screen.getByText('translated-creditMarket:marketDisclaimer')
    const tableComponent = screen.getByTestId('credit-market-table')
    const accordionComponent = screen.getByTestId('credit-market-accordion')
    
    expect(disclaimerText).toBeInTheDocument()
    expect(tableComponent).toBeInTheDocument()
    expect(accordionComponent).toBeInTheDocument()
  })

  it('shows details card for BCeID users with their organization', () => {
    renderComponent()
    const detailsCard = screen.getByTestId('credit-market-details-card')
    expect(detailsCard).toHaveTextContent('Details Card 42')
  })

  it('shows details card after government user selects a row', () => {
    mockHasAnyRole.mockReturnValue(true)
    renderComponent()
    expect(screen.queryByTestId('credit-market-details-card')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Select Row'))
    expect(screen.getByTestId('credit-market-details-card')).toHaveTextContent('Details Card 1')
  })

  it('renders clear filters button', () => {
    renderComponent()
    expect(screen.getByTestId('clear-filters-button')).toBeInTheDocument()
  })

  it('clears selection via button', () => {
    mockHasAnyRole.mockReturnValue(true)
    renderComponent()
    fireEvent.click(screen.getByText('Select Row'))
    expect(screen.getByTestId('credit-market-details-card')).toBeInTheDocument()
    const clearSelectionButton = screen.getByRole('button', {
      name: 'translated-creditMarket:clearSelection'
    })
    fireEvent.click(clearSelectionButton)
    expect(screen.queryByTestId('credit-market-details-card')).not.toBeInTheDocument()
  })
})
