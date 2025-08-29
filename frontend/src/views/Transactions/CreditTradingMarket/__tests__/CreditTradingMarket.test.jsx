import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CreditTradingMarket } from '../CreditTradingMarket'

// Mock child components
vi.mock('../CreditMarketTable', () => ({
  CreditMarketTable: () => <div data-test="credit-market-table">Credit Market Table</div>
}))

vi.mock('../CreditMarketAccordion', () => ({
  CreditMarketAccordion: () => <div data-test="credit-market-accordion">Credit Market Accordion</div>
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
  it('renders without crashing', () => {
    render(<CreditTradingMarket />)
    expect(screen.getByTestId('credit-market-table')).toBeInTheDocument()
    expect(screen.getByTestId('credit-market-accordion')).toBeInTheDocument()
  })

  it('calls useTranslation with creditMarket namespace', async () => {
    const { useTranslation } = await import('react-i18next')
    render(<CreditTradingMarket />)
    expect(vi.mocked(useTranslation)).toHaveBeenCalledWith(['creditMarket'])
  })

  it('renders heading with correct translation key', () => {
    render(<CreditTradingMarket />)
    expect(mockT).toHaveBeenCalledWith('creditMarket:marketHeading')
    expect(screen.getByText('translated-creditMarket:marketHeading')).toBeInTheDocument()
  })

  it('renders disclaimer with correct translation key', () => {
    render(<CreditTradingMarket />)
    expect(mockT).toHaveBeenCalledWith('creditMarket:marketDisclaimer')
    expect(screen.getByText('translated-creditMarket:marketDisclaimer')).toBeInTheDocument()
  })

  it('renders CreditMarketTable component', () => {
    render(<CreditTradingMarket />)
    expect(screen.getByTestId('credit-market-table')).toBeInTheDocument()
    expect(screen.getByText('Credit Market Table')).toBeInTheDocument()
  })

  it('renders CreditMarketAccordion component', () => {
    render(<CreditTradingMarket />)
    expect(screen.getByTestId('credit-market-accordion')).toBeInTheDocument()
    expect(screen.getByText('Credit Market Accordion')).toBeInTheDocument()
  })

  it('renders with correct component structure', () => {
    render(<CreditTradingMarket />)
    
    // Check that heading has correct styling properties
    const headings = screen.getAllByTestId('bc-typography')
    const mainHeading = headings.find(el => el.getAttribute('data-variant') === 'h4')
    const disclaimer = headings.find(el => el.getAttribute('data-variant') === 'body2')
    
    expect(mainHeading).toBeInTheDocument()
    expect(mainHeading).toHaveAttribute('data-mb', '2')
    expect(mainHeading).toHaveAttribute('data-sx', JSON.stringify({ color: 'primary.main' }))
    
    expect(disclaimer).toBeInTheDocument()
    expect(disclaimer).toHaveAttribute('data-color', 'text.secondary')
    expect(disclaimer).toHaveAttribute('data-mb', '3')
  })

  it('renders all required elements in correct order', () => {
    render(<CreditTradingMarket />)
    
    const headingText = screen.getByText('translated-creditMarket:marketHeading')
    const disclaimerText = screen.getByText('translated-creditMarket:marketDisclaimer')
    const tableComponent = screen.getByTestId('credit-market-table')
    const accordionComponent = screen.getByTestId('credit-market-accordion')
    
    expect(headingText).toBeInTheDocument()
    expect(disclaimerText).toBeInTheDocument()
    expect(tableComponent).toBeInTheDocument()
    expect(accordionComponent).toBeInTheDocument()
  })
})