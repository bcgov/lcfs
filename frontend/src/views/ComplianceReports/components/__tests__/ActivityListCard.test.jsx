import React from 'react'
import { describe, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { ActivityListCard } from '../ActivityListCard'
import { test } from '@/tests/utils/fixtures'

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
    <div data-test="bc-box" data-sx={JSON.stringify(sx)} {...props}>
      {children}
    </div>
  )
}))

vi.mock('../ActivityLinksList', () => ({
  ActivityLinksList: ({
    currentStatus,
    isQuarterlyReport,
    reportQuarter,
    ...props
  }) => (
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
    test('renders without crashing', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<ActivityListCard currentStatus="Draft" />, [
        query,
        theme,
        localization,
        router
      ])

      expect(screen.getByTestId('bc-widget-card')).toBeInTheDocument()
      expect(screen.getByTestId('bc-box')).toBeInTheDocument()
      expect(screen.getByTestId('activity-links-list')).toBeInTheDocument()
    })

    test('renders BCWidgetCard with correct props', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<ActivityListCard currentStatus="Draft" />, [
        query,
        theme,
        localization,
        router
      ])

      const widgetCard = screen.getByTestId('bc-widget-card')
      expect(widgetCard).toHaveAttribute('data-component', 'div')
      expect(widgetCard).toHaveAttribute(
        'data-style',
        '{"height":"fit-content"}'
      )
      expect(widgetCard).toHaveAttribute(
        'data-title',
        'report:reportActivities'
      )
      expect(widgetCard).toHaveAttribute(
        'data-sx',
        '{"& .MuiCardContent-root":{"padding":"16px"}}'
      )
    })

    test('renders BCBox with correct styling', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<ActivityListCard currentStatus="Draft" />, [
        query,
        theme,
        localization,
        router
      ])

      const bcBox = screen.getByTestId('bc-box')
      expect(bcBox).toHaveAttribute(
        'data-sx',
        '{"marginTop":"5px","display":"flex","flexDirection":"column","gap":2}'
      )
    })
  })

  describe('Props Handling', () => {
    test('passes currentStatus to ActivityLinksList', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const currentStatus = 'Draft'
      render(<ActivityListCard currentStatus={currentStatus} />, [
        query,
        theme,
        localization,
        router
      ])

      const activityLinksList = screen.getByTestId('activity-links-list')
      expect(activityLinksList).toHaveAttribute(
        'data-current-status',
        currentStatus
      )
    })

    test('uses default quarter when not provided', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<ActivityListCard currentStatus="Draft" />, [
        query,
        theme,
        localization,
        router
      ])

      const activityLinksList = screen.getByTestId('activity-links-list')
      expect(activityLinksList).toHaveAttribute('data-report-quarter', '')
    })

    test('uses default isQuarterlyReport when not provided', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<ActivityListCard currentStatus="Draft" />, [
        query,
        theme,
        localization,
        router
      ])

      const activityLinksList = screen.getByTestId('activity-links-list')
      expect(activityLinksList).toHaveAttribute(
        'data-is-quarterly-report',
        'false'
      )
    })

    test('passes quarter prop to ActivityLinksList when provided', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const quarter = 'Q1'
      render(<ActivityListCard currentStatus="Draft" quarter={quarter} />, [
        query,
        theme,
        localization,
        router
      ])

      const activityLinksList = screen.getByTestId('activity-links-list')
      expect(activityLinksList).toHaveAttribute('data-report-quarter', quarter)
    })

    test('passes isQuarterlyReport prop to ActivityLinksList when true', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <ActivityListCard currentStatus="Draft" isQuarterlyReport={true} />,
        [query, theme, localization, router]
      )

      const activityLinksList = screen.getByTestId('activity-links-list')
      expect(activityLinksList).toHaveAttribute(
        'data-is-quarterly-report',
        'true'
      )
    })

    test('passes isQuarterlyReport prop to ActivityLinksList when false', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <ActivityListCard currentStatus="Draft" isQuarterlyReport={false} />,
        [query, theme, localization, router]
      )

      const activityLinksList = screen.getByTestId('activity-links-list')
      expect(activityLinksList).toHaveAttribute(
        'data-is-quarterly-report',
        'false'
      )
    })
  })

  describe('Translation Integration', () => {
    test('uses translation key for title', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<ActivityListCard currentStatus="Draft" />, [
        query,
        theme,
        localization,
        router
      ])

      const widgetCard = screen.getByTestId('bc-widget-card')
      expect(widgetCard).toHaveAttribute(
        'data-title',
        'report:reportActivities'
      )
    })
  })

  describe('Edge Cases', () => {
    test('handles empty string quarter', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<ActivityListCard currentStatus="Draft" quarter="" />, [
        query,
        theme,
        localization,
        router
      ])

      const activityLinksList = screen.getByTestId('activity-links-list')
      expect(activityLinksList).toHaveAttribute('data-report-quarter', '')
    })

    test('handles all props together', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const props = {
        currentStatus: 'Approved',
        quarter: 'Q4',
        isQuarterlyReport: true
      }

      render(<ActivityListCard {...props} />, [
        query,
        theme,
        localization,
        router
      ])

      const activityLinksList = screen.getByTestId('activity-links-list')
      expect(activityLinksList).toHaveAttribute(
        'data-current-status',
        'Approved'
      )
      expect(activityLinksList).toHaveAttribute('data-report-quarter', 'Q4')
      expect(activityLinksList).toHaveAttribute(
        'data-is-quarterly-report',
        'true'
      )
    })
  })
})
