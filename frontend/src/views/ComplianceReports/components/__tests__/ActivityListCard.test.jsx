import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActivityListCard } from '../ActivityListCard'
import { wrapper } from '@/tests/utils/wrapper'

// Mock useTranslation hook
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key) => key)
  }))
}))

// Mock child components with props forwarding for testing
vi.mock('@/components/BCWidgetCard/BCWidgetCard', () => ({
  default: ({ title, content, component, style, sx, ...props }) => (
    <div
      data-test="bc-widget-card"
      data-title={title}
      data-component={component}
      data-style={JSON.stringify(style)}
      data-sx={JSON.stringify(sx)}
      {...props}
    >
      {content}
    </div>
  )
}))

vi.mock('@/components/BCBox', () => ({
  default: ({ children, sx, ...props }) => (
    <div
      data-test="bc-box"
      data-sx={JSON.stringify(sx)}
      {...props}
    >
      {children}
    </div>
  )
}))

vi.mock('../ActivityLinksList', () => ({
  ActivityLinksList: ({ currentStatus, isQuarterlyReport, reportQuarter, ...props }) => (
    <div
      data-test="activity-links-list"
      data-current-status={currentStatus}
      data-is-quarterly-report={isQuarterlyReport?.toString()}
      data-report-quarter={reportQuarter}
      {...props}
    />
  )
}))

describe('ActivityListCard', () => {
  const mockT = vi.fn((key) => key)

  beforeEach(() => {
    vi.clearAllMocks()
    mockT.mockImplementation((key) => key)
    vi.mocked(vi.fn(() => ({ t: mockT })))
  })

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(
        <ActivityListCard currentStatus="Draft" />,
        { wrapper }
      )
      
      expect(screen.getByTestId('bc-widget-card')).toBeInTheDocument()
      expect(screen.getByTestId('bc-box')).toBeInTheDocument()
      expect(screen.getByTestId('activity-links-list')).toBeInTheDocument()
    })

    it('renders BCWidgetCard with correct props', () => {
      render(
        <ActivityListCard currentStatus="Draft" />,
        { wrapper }
      )
      
      const widgetCard = screen.getByTestId('bc-widget-card')
      expect(widgetCard).toHaveAttribute('data-component', 'div')
      expect(widgetCard).toHaveAttribute('data-style', '{"height":"fit-content"}')
      expect(widgetCard).toHaveAttribute('data-title', 'report:reportActivities')
      expect(widgetCard).toHaveAttribute('data-sx', '{"& .MuiCardContent-root":{"padding":"16px"}}')
    })

    it('renders BCBox with correct styling', () => {
      render(
        <ActivityListCard currentStatus="Draft" />,
        { wrapper }
      )
      
      const bcBox = screen.getByTestId('bc-box')
      expect(bcBox).toHaveAttribute('data-sx', '{"marginTop":"5px","display":"flex","flexDirection":"column","gap":2}')
    })
  })

  describe('Props Handling', () => {
    it('passes currentStatus to ActivityLinksList', () => {
      const currentStatus = 'Draft'
      render(
        <ActivityListCard currentStatus={currentStatus} />,
        { wrapper }
      )
      
      const activityLinksList = screen.getByTestId('activity-links-list')
      expect(activityLinksList).toHaveAttribute('data-current-status', currentStatus)
    })

    it('uses default quarter when not provided', () => {
      render(
        <ActivityListCard currentStatus="Draft" />,
        { wrapper }
      )
      
      const activityLinksList = screen.getByTestId('activity-links-list')
      expect(activityLinksList).toHaveAttribute('data-report-quarter', '')
    })

    it('uses default isQuarterlyReport when not provided', () => {
      render(
        <ActivityListCard currentStatus="Draft" />,
        { wrapper }
      )
      
      const activityLinksList = screen.getByTestId('activity-links-list')
      expect(activityLinksList).toHaveAttribute('data-is-quarterly-report', 'false')
    })

    it('passes quarter prop to ActivityLinksList when provided', () => {
      const quarter = 'Q1'
      render(
        <ActivityListCard 
          currentStatus="Draft" 
          quarter={quarter} 
        />,
        { wrapper }
      )
      
      const activityLinksList = screen.getByTestId('activity-links-list')
      expect(activityLinksList).toHaveAttribute('data-report-quarter', quarter)
    })

    it('passes isQuarterlyReport prop to ActivityLinksList when true', () => {
      render(
        <ActivityListCard 
          currentStatus="Draft" 
          isQuarterlyReport={true}
        />,
        { wrapper }
      )
      
      const activityLinksList = screen.getByTestId('activity-links-list')
      expect(activityLinksList).toHaveAttribute('data-is-quarterly-report', 'true')
    })

    it('passes isQuarterlyReport prop to ActivityLinksList when false', () => {
      render(
        <ActivityListCard 
          currentStatus="Draft" 
          isQuarterlyReport={false}
        />,
        { wrapper }
      )
      
      const activityLinksList = screen.getByTestId('activity-links-list')
      expect(activityLinksList).toHaveAttribute('data-is-quarterly-report', 'false')
    })
  })

  describe('Translation Integration', () => {
    it('uses translation key for title', () => {
      render(
        <ActivityListCard currentStatus="Draft" />,
        { wrapper }
      )
      
      const widgetCard = screen.getByTestId('bc-widget-card')
      expect(widgetCard).toHaveAttribute('data-title', 'report:reportActivities')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty string quarter', () => {
      render(
        <ActivityListCard 
          currentStatus="Draft" 
          quarter=""
        />,
        { wrapper }
      )
      
      const activityLinksList = screen.getByTestId('activity-links-list')
      expect(activityLinksList).toHaveAttribute('data-report-quarter', '')
    })

    it('handles all props together', () => {
      const props = {
        currentStatus: 'Approved',
        quarter: 'Q4',
        isQuarterlyReport: true
      }
      
      render(
        <ActivityListCard {...props} />,
        { wrapper }
      )
      
      const activityLinksList = screen.getByTestId('activity-links-list')
      expect(activityLinksList).toHaveAttribute('data-current-status', 'Approved')
      expect(activityLinksList).toHaveAttribute('data-report-quarter', 'Q4')
      expect(activityLinksList).toHaveAttribute('data-is-quarterly-report', 'true')
    })
  })
})