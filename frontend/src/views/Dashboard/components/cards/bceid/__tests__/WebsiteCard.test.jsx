import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import WebsiteCard from '../WebsiteCard'

// Mock react-i18next
const mockT = vi.fn((key) => {
  const translations = {
    'dashboard:website.title': 'Low Carbon Fuel Standard Information',
    'dashboard:website.linkText': 'For more information visit:',
    'dashboard:website.linkTooltip': 'Visit the LCFS information page',
    'dashboard:website.linkUrl': 'gov.bc.ca/lowcarbonfuels'
  }
  return translations[key] || key
})

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: mockT
  }))
}))

// Mock MUI components
vi.mock('@mui/material', () => ({
  Box: ({ children, ...props }) => (
    <div data-test="box" data-props={JSON.stringify(props)}>
      {children}
    </div>
  )
}))

// Mock BCTypography
vi.mock('@/components/BCTypography', () => ({
  __esModule: true,
  default: ({ children, style, gutterBottom, ...props }) => (
    <div 
      data-test="bc-typography" 
      data-style={JSON.stringify(style)}
      data-gutter-bottom={gutterBottom}
      data-props={JSON.stringify(props)}
    >
      {children}
    </div>
  )
}))

// Mock FontAwesome
vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon, style, ...props }) => (
    <span 
      data-test="font-awesome-icon"
      data-icon={JSON.stringify(icon)}
      data-style={JSON.stringify(style)}
      data-props={JSON.stringify(props)}
    />
  )
}))

vi.mock('@fortawesome/free-solid-svg-icons', () => ({
  faShareFromSquare: { iconName: 'share-from-square' }
}))

describe('WebsiteCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<WebsiteCard />)
    expect(screen.getByTestId('box')).toBeInTheDocument()
  })


  it('renders Box container with correct props', () => {
    render(<WebsiteCard />)
    const box = screen.getByTestId('box')
    const props = JSON.parse(box.getAttribute('data-props'))
    
    expect(props.p).toBe(2)
    expect(props.paddingTop).toBe(4)
    expect(props.paddingBottom).toBe(4)
    expect(props.bgcolor).toBe('background.grey')
    expect(props.display).toBe('flex')
    expect(props.flexDirection).toBe('column')
    expect(props.alignItems).toBe('center')
    expect(props.justifyContent).toBe('center')
  })

  it('renders title BCTypography with correct styling', () => {
    render(<WebsiteCard />)
    const typographies = screen.getAllByTestId('bc-typography')
    const titleTypography = typographies[0]
    
    const style = JSON.parse(titleTypography.getAttribute('data-style'))
    expect(style.fontSize).toBe('18px')
    expect(style.color).toBe('#003366')
    expect(style.marginBottom).toBe('12px')
    expect(style.textAlign).toBe('center')
    expect(titleTypography.getAttribute('data-gutter-bottom')).toBe('true')
  })

  it('renders content BCTypography with correct styling', () => {
    render(<WebsiteCard />)
    const typographies = screen.getAllByTestId('bc-typography')
    const contentTypography = typographies[1]
    
    const style = JSON.parse(contentTypography.getAttribute('data-style'))
    expect(style.fontSize).toBe('16px')
    expect(style.color).toBe('#003366')
    expect(style.textAlign).toBe('center')
  })

  it('calls translation function for title', () => {
    render(<WebsiteCard />)
    expect(mockT).toHaveBeenCalledWith('dashboard:website.title')
    expect(screen.getByText('Low Carbon Fuel Standard Information')).toBeInTheDocument()
  })

  it('calls translation function for link text', () => {
    render(<WebsiteCard />)
    expect(mockT).toHaveBeenCalledWith('dashboard:website.linkText')
    expect(screen.getByText('For more information visit:')).toBeInTheDocument()
  })

  it('calls translation function for link tooltip', () => {
    render(<WebsiteCard />)
    expect(mockT).toHaveBeenCalledWith('dashboard:website.linkTooltip')
  })

  it('calls translation function for link URL text', () => {
    render(<WebsiteCard />)
    expect(mockT).toHaveBeenCalledWith('dashboard:website.linkUrl')
    expect(screen.getByText('gov.bc.ca/lowcarbonfuels')).toBeInTheDocument()
  })

  it('renders external link with correct attributes', () => {
    render(<WebsiteCard />)
    const link = screen.getByRole('link')
    
    expect(link).toHaveAttribute('href', 'http://gov.bc.ca/lowcarbonfuels')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveAttribute('title', 'Visit the LCFS information page')
  })

  it('renders FontAwesome icon with correct props', () => {
    render(<WebsiteCard />)
    const icon = screen.getByTestId('font-awesome-icon')
    
    const iconProp = JSON.parse(icon.getAttribute('data-icon'))
    expect(iconProp.iconName).toBe('share-from-square')
    
    const style = JSON.parse(icon.getAttribute('data-style'))
    expect(style.marginLeft).toBe('6px')
    expect(style.color).toBe('#547D59')
  })

  it('has correct component structure', () => {
    render(<WebsiteCard />)
    
    // Box container
    const box = screen.getByTestId('box')
    expect(box).toBeInTheDocument()
    
    // Two typography components
    const typographies = screen.getAllByTestId('bc-typography')
    expect(typographies).toHaveLength(2)
    
    // One link
    const link = screen.getByRole('link')
    expect(link).toBeInTheDocument()
    
    // One icon
    const icon = screen.getByTestId('font-awesome-icon')
    expect(icon).toBeInTheDocument()
  })

  it('renders line break element', () => {
    const { container } = render(<WebsiteCard />)
    const lineBreak = container.querySelector('br')
    expect(lineBreak).toBeInTheDocument()
  })
})