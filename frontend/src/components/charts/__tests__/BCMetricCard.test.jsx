import { screen } from '@testing-library/react'
import { describe, expect, vi } from 'vitest'
import { BCMetricCard } from '../BCMetricCard'
import { test } from '@/tests/utils/fixtures'

vi.mock('../BCResponsiveEchart', () => ({
  BCResponsiveEChart: ({ option, ariaLabel }) => (
    <div
      data-test="bc-responsive-echart"
      role="img"
      aria-label={ariaLabel}
      data-has-option={Boolean(option)}
    />
  )
}))

describe('BCMetricCard', () => {
  describe('rendering', () => {
    test('renders title and value', ({ render, theme }) => {
      render(<BCMetricCard title="Total Credits" value="1,234" />, [theme])

      expect(screen.getByText('1,234')).toBeInTheDocument()
      expect(screen.getByText('Total Credits')).toBeInTheDocument()
    })

    test('renders optional subtitle when provided', ({ render, theme }) => {
      render(
        <BCMetricCard
          title="Total Credits"
          value="1,234"
          subtitle="Updated today"
        />,
        [theme]
      )

      expect(screen.getByText('Updated today')).toBeInTheDocument()
    })

    test('uses title as default aria label for the card region', ({
      render,
      theme
    }) => {
      render(<BCMetricCard title="Total Credits" value="1,234" />, [theme])

      expect(
        screen.getByRole('region', { name: 'Total Credits' })
      ).toBeInTheDocument()
    })
  })

  describe('value display', () => {
    test('displays numeric and formatted values', ({ render, theme }) => {
      render(<BCMetricCard title="Balance" value="$5,678.90" />, [theme])

      expect(screen.getByText('$5,678.90')).toBeInTheDocument()
    })

    test('embeds a chart when an option is provided', ({ render, theme }) => {
      render(
        <BCMetricCard
          title="Trend"
          value="42"
          option={{ series: [{ data: [1, 2, 3] }] }}
          ariaLabel="Trend chart"
        />,
        [theme]
      )

      const chart = screen.getByTestId('bc-responsive-echart')
      expect(chart).toBeInTheDocument()
      expect(chart).toHaveAttribute('data-has-option', 'true')
    })

    test('does not render a chart when option is omitted', ({
      render,
      theme
    }) => {
      render(<BCMetricCard title="Trend" value="42" />, [theme])

      expect(
        screen.queryByTestId('bc-responsive-echart')
      ).not.toBeInTheDocument()
    })

    test('displays large numeric values', ({ render, theme }) => {
      render(<BCMetricCard title="Total" value="1,234,567" />, [theme])

      expect(screen.getByText('1,234,567')).toBeInTheDocument()
    })

    test('displays negative values', ({ render, theme }) => {
      render(<BCMetricCard title="Deficit" value="-500" />, [theme])

      expect(screen.getByText('-500')).toBeInTheDocument()
    })

    test('displays percentage values', ({ render, theme }) => {
      render(<BCMetricCard title="Growth" value="15.5%" />, [theme])

      expect(screen.getByText('15.5%')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    test('uses title as aria-label when custom label not provided', ({
      render,
      theme
    }) => {
      render(<BCMetricCard title="Metric Title" value="100" />, [theme])

      expect(
        screen.getByRole('region', { name: 'Metric Title' })
      ).toBeInTheDocument()
    })

    test('uses custom ariaLabel when provided', ({ render, theme }) => {
      render(
        <BCMetricCard title="Metric" value="100" ariaLabel="Custom label" />,
        [theme]
      )

      expect(
        screen.getByRole('region', { name: 'Custom label' })
      ).toBeInTheDocument()
    })

    test('renders focusable card', ({ render, theme }) => {
      render(<BCMetricCard title="Focusable" value="100" />, [theme])

      const card = screen.getByRole('region', { name: 'Focusable' })
      expect(card).toHaveAttribute('tabindex', '0')
    })
  })

  describe('layout', () => {
    test('renders title, value, and subtitle in correct order', ({
      render,
      theme
    }) => {
      render(<BCMetricCard title="Title" value="Value" subtitle="Subtitle" />, [
        theme
      ])

      const region = screen.getByRole('region')
      const text = region.textContent

      expect(text).toContain('Value')
      expect(text).toContain('Title')
      expect(text).toContain('Subtitle')
    })

    test('renders without subtitle when not provided', ({ render, theme }) => {
      render(<BCMetricCard title="Title" value="Value" />, [theme])

      expect(screen.getByText('Title')).toBeInTheDocument()
      expect(screen.getByText('Value')).toBeInTheDocument()
    })
  })

  describe('chart integration', () => {
    test('passes aria-label to chart component', ({ render, theme }) => {
      render(
        <BCMetricCard
          title="Trend"
          value="42"
          option={{ series: [{ data: [1, 2, 3] }] }}
          ariaLabel="Trend visualization"
        />,
        [theme]
      )

      const chart = screen.getByRole('img', { name: 'Trend visualization' })
      expect(chart).toBeInTheDocument()
    })

    test('renders chart with correct height', ({ render, theme }) => {
      render(
        <BCMetricCard
          title="Chart Card"
          value="100"
          option={{ series: [{ data: [1, 2, 3] }] }}
        />,
        [theme]
      )

      expect(screen.getByTestId('bc-responsive-echart')).toBeInTheDocument()
    })
  })

  describe('visual presentation', () => {
    test('renders as a Material-UI Card', ({ render, theme }) => {
      const { container } = render(<BCMetricCard title="Card" value="100" />, [
        theme
      ])

      expect(container.querySelector('.MuiCard-root')).toBeInTheDocument()
    })
  })
})
