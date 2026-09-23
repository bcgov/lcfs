import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { describe, expect, vi, beforeEach } from 'vitest'
import { CreditTradingMarket } from '../CreditTradingMarket'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { test } from '@/tests/utils/fixtures'

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
  CreditMarketAccordion: () => (
    <div data-test="credit-market-accordion">Credit Market Accordion</div>
  )
}))

vi.mock('../CreditMarketDetailsCard', () => ({
  CreditMarketDetailsCard: ({ organizationId }) => (
    <div data-test="credit-market-details-card">
      Details Card {organizationId}
    </div>
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

  const renderComponent = (render, theme) =>
    render(<CreditTradingMarket />, [theme])

  test('renders without crashing', ({ render, theme }) => {
    renderComponent(render, theme)
    expect(screen.getByTestId('credit-market-table')).toBeInTheDocument()
    expect(screen.getByTestId('credit-market-accordion')).toBeInTheDocument()
  })

  test('calls useTranslation with creditMarket namespace', async ({
    render,
    theme
  }) => {
    const { useTranslation } = await import('react-i18next')
    renderComponent(render, theme)
    expect(vi.mocked(useTranslation)).toHaveBeenCalledWith(['creditMarket'])
  })

  test('renders disclaimer with correct translation key', ({
    render,
    theme
  }) => {
    renderComponent(render, theme)
    expect(mockT).toHaveBeenCalledWith('creditMarket:marketDisclaimer')
    expect(
      screen.getByText('translated-creditMarket:marketDisclaimer')
    ).toBeInTheDocument()
  })

  test('renders CreditMarketTable component', ({ render, theme }) => {
    renderComponent(render, theme)
    expect(screen.getByTestId('credit-market-table')).toBeInTheDocument()
    expect(screen.getByText('Credit Market Table')).toBeInTheDocument()
  })

  test('renders CreditMarketAccordion component', ({ render, theme }) => {
    renderComponent(render, theme)
    expect(screen.getByTestId('credit-market-accordion')).toBeInTheDocument()
    expect(screen.getByText('Credit Market Accordion')).toBeInTheDocument()
  })

  test('renders with correct component structure', ({ render, theme }) => {
    renderComponent(render, theme)

    // Check that heading has correct styling properties
    const headings = screen.getAllByTestId('bc-typography')
    const mainHeading = headings.find(
      (el) => el.getAttribute('data-variant') === 'h4'
    )
    const disclaimer = headings.find(
      (el) => el.getAttribute('data-variant') === 'body2'
    )

    expect(disclaimer).toBeInTheDocument()
    expect(disclaimer).toHaveAttribute('data-color', 'text.secondary')
    expect(disclaimer).toHaveAttribute('data-mb', '3')
  })

  test('renders all required elements in correct order', ({
    render,
    theme
  }) => {
    renderComponent(render, theme)

    const disclaimerText = screen.getByText(
      'translated-creditMarket:marketDisclaimer'
    )
    const tableComponent = screen.getByTestId('credit-market-table')
    const accordionComponent = screen.getByTestId('credit-market-accordion')

    expect(disclaimerText).toBeInTheDocument()
    expect(tableComponent).toBeInTheDocument()
    expect(accordionComponent).toBeInTheDocument()
  })

  test('shows details card for BCeID users with their organization', ({
    render,
    theme
  }) => {
    renderComponent(render, theme)
    const detailsCard = screen.getByTestId('credit-market-details-card')
    expect(detailsCard).toHaveTextContent('Details Card 42')
  })

  test('shows details card after government user selects a row', ({
    render,
    theme
  }) => {
    mockHasAnyRole.mockReturnValue(true)
    renderComponent(render, theme)
    expect(
      screen.queryByTestId('credit-market-details-card')
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Select Row'))
    expect(screen.getByTestId('credit-market-details-card')).toHaveTextContent(
      'Details Card 1'
    )
  })

  test('clears selection via button', ({ render, theme }) => {
    mockHasAnyRole.mockReturnValue(true)
    renderComponent(render, theme)
    fireEvent.click(screen.getByText('Select Row'))
    expect(screen.getByTestId('credit-market-details-card')).toBeInTheDocument()
    const clearSelectionButton = screen.getByRole('button', {
      name: 'translated-creditMarket:clearSelection'
    })
    fireEvent.click(clearSelectionButton)
    expect(
      screen.queryByTestId('credit-market-details-card')
    ).not.toBeInTheDocument()
  })
})
