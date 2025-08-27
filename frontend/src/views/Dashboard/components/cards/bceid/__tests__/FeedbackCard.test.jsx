import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTranslation } from 'react-i18next'
import FeedbackCard from '../FeedbackCard'

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn()
}))

vi.mock('@mui/material', () => ({
  Box: vi.fn(({ children, ...props }) => (
    <div data-test="box" {...props}>{children}</div>
  )),
  Icon: vi.fn(({ children, sx, ...props }) => (
    <div data-test="icon" data-sx={JSON.stringify(sx)} {...props}>{children}</div>
  ))
}))

vi.mock('@mui/icons-material', () => ({
  Mail: vi.fn(() => <div data-test="mail-icon">Mail</div>)
}))

vi.mock('@/components/BCTypography', () => ({
  __esModule: true,
  default: vi.fn(({ children, style, color, gutterBottom, dangerouslySetInnerHTML, ...props }) => (
    <div 
      data-test="bc-typography" 
      data-style={JSON.stringify(style)}
      data-color={color}
      data-gutter-bottom={gutterBottom}
      data-dangerous-html={JSON.stringify(dangerouslySetInnerHTML)}
      {...props}
    >
      {children}
    </div>
  ))
}))

describe('FeedbackCard', () => {
  const mockT = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockT.mockImplementation((key) => {
      const translations = {
        'dashboard:feedback.title': 'Feedback Title',
        'dashboard:feedback.email': '<a href="mailto:test@example.com">test@example.com</a>'
      }
      return translations[key] || key
    })
    useTranslation.mockReturnValue({ t: mockT })
  })

  it('renders without errors', () => {
    render(<FeedbackCard />)
    expect(screen.getByTestId('box')).toBeInTheDocument()
  })

  it('calls useTranslation with correct namespace', () => {
    render(<FeedbackCard />)
    expect(useTranslation).toHaveBeenCalledWith(['dashboard'])
  })

  it('calls translation function with title key', () => {
    render(<FeedbackCard />)
    expect(mockT).toHaveBeenCalledWith('dashboard:feedback.title')
  })

  it('calls translation function with email key', () => {
    render(<FeedbackCard />)
    expect(mockT).toHaveBeenCalledWith('dashboard:feedback.email')
  })

  it('renders Box component with correct styling props', () => {
    render(<FeedbackCard />)
    const boxElement = screen.getByTestId('box')
    expect(boxElement).toBeInTheDocument()
    expect(boxElement).toHaveAttribute('p', '2')
    expect(boxElement).toHaveAttribute('paddingTop', '4')
    expect(boxElement).toHaveAttribute('paddingBottom', '4')
    expect(boxElement).toHaveAttribute('bgcolor', 'background.grey')
    expect(boxElement).toHaveAttribute('display', 'flex')
    expect(boxElement).toHaveAttribute('flexDirection', 'column')
    expect(boxElement).toHaveAttribute('alignItems', 'center')
    expect(boxElement).toHaveAttribute('justifyContent', 'center')
  })

  it('renders Icon component with correct styling', () => {
    render(<FeedbackCard />)
    const iconElement = screen.getByTestId('icon')
    expect(iconElement).toBeInTheDocument()
    const sxData = JSON.parse(iconElement.getAttribute('data-sx'))
    expect(sxData).toEqual({ color: '#547D59', fontSize: 60 })
  })

  it('renders Mail icon inside Icon component', () => {
    render(<FeedbackCard />)
    expect(screen.getByTestId('mail-icon')).toBeInTheDocument()
    expect(screen.getByText('Mail')).toBeInTheDocument()
  })

  it('renders first BCTypography with correct styling and content', () => {
    render(<FeedbackCard />)
    const typographyElements = screen.getAllByTestId('bc-typography')
    const titleTypography = typographyElements[0]
    
    expect(titleTypography).toBeInTheDocument()
    expect(titleTypography).toHaveAttribute('data-gutter-bottom', 'true')
    
    const styleData = JSON.parse(titleTypography.getAttribute('data-style'))
    expect(styleData).toEqual({
      fontSize: '18px',
      color: '#003366',
      marginBottom: '12px',
      textAlign: 'center'
    })
    
    expect(titleTypography).toHaveTextContent('Feedback Title')
  })

  it('renders second BCTypography with dangerouslySetInnerHTML', () => {
    render(<FeedbackCard />)
    const typographyElements = screen.getAllByTestId('bc-typography')
    const emailTypography = typographyElements[1]
    
    expect(emailTypography).toBeInTheDocument()
    expect(emailTypography).toHaveAttribute('data-color', 'link')
    
    const styleData = JSON.parse(emailTypography.getAttribute('data-style'))
    expect(styleData).toEqual({
      fontSize: '16px',
      color: '#003366',
      textAlign: 'center'
    })
    
    const dangerousHtml = JSON.parse(emailTypography.getAttribute('data-dangerous-html'))
    expect(dangerousHtml).toEqual({
      __html: '<a href="mailto:test@example.com">test@example.com</a>'
    })
  })

  it('renders component with correct structure hierarchy', () => {
    render(<FeedbackCard />)
    
    const box = screen.getByTestId('box')
    const icon = screen.getByTestId('icon')
    const mailIcon = screen.getByTestId('mail-icon')
    const typographies = screen.getAllByTestId('bc-typography')
    
    expect(box).toContainElement(icon)
    expect(icon).toContainElement(mailIcon)
    expect(box).toContainElement(typographies[0])
    expect(box).toContainElement(typographies[1])
    expect(typographies).toHaveLength(2)
  })
})