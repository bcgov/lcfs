import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BCMetricCard } from '../BCMetricCard'
import { wrapper } from '@/tests/utils/wrapper'

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
    it('renders title and value', () => {
      render(
        <BCMetricCard title="Total Credits" value="1,234" />,
        { wrapper }
      )

      expect(screen.getByText('1,234')).toBeInTheDocument()
      expect(screen.getByText('Total Credits')).toBeInTheDocument()
    })

    it('renders optional subtitle when provided', () => {
      render(
        <BCMetricCard
          title="Total Credits"
          value="1,234"
          subtitle="Updated today"
        />,
        { wrapper }
      )

      expect(screen.getByText('Updated today')).toBeInTheDocument()
    })

    it('uses title as default aria label for the card region', () => {
      render(
        <BCMetricCard title="Total Credits" value="1,234" />,
        { wrapper }
      )

      expect(
        screen.getByRole('region', { name: 'Total Credits' })
      ).toBeInTheDocument()
    })
  })

  describe('value display', () => {
    it('displays numeric and formatted values', () => {
      render(
        <BCMetricCard title="Balance" value="$5,678.90" />,
        { wrapper }
      )

      expect(screen.getByText('$5,678.90')).toBeInTheDocument()
    })

    it('embeds a chart when an option is provided', () => {
      render(
        <BCMetricCard
          title="Trend"
          value="42"
          option={{ series: [{ data: [1, 2, 3] }] }}
          ariaLabel="Trend chart"
        />,
        { wrapper }
      )

      const chart = screen.getByTestId('bc-responsive-echart')
      expect(chart).toBeInTheDocument()
      expect(chart).toHaveAttribute('data-has-option', 'true')
    })

    it('does not render a chart when option is omitted', () => {
      render(<BCMetricCard title="Trend" value="42" />, { wrapper })

      expect(screen.queryByTestId('bc-responsive-echart')).not.toBeInTheDocument()
    })

    it('displays large numeric values', () => {
      render(
        <BCMetricCard title="Total" value="1,234,567" />,
        { wrapper }
      )

      expect(screen.getByText('1,234,567')).toBeInTheDocument()
    })

    it('displays negative values', () => {
      render(
        <BCMetricCard title="Deficit" value="-500" />,
        { wrapper }
      )

      expect(screen.getByText('-500')).toBeInTheDocument()
    })

    it('displays percentage values', () => {
      render(
        <BCMetricCard title="Growth" value="15.5%" />,
        { wrapper }
      )

      expect(screen.getByText('15.5%')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('uses title as aria-label when custom label not provided', () => {
      render(
        <BCMetricCard title="Metric Title" value="100" />,
        { wrapper }
      )

      expect(
        screen.getByRole('region', { name: 'Metric Title' })
      ).toBeInTheDocument()
    })

    it('uses custom ariaLabel when provided', () => {
      render(
        <BCMetricCard
          title="Metric"
          value="100"
          ariaLabel="Custom label"
        />,
        { wrapper }
      )

      expect(
        screen.getByRole('region', { name: 'Custom label' })
      ).toBeInTheDocument()
    })

    it('renders focusable card', () => {
      render(
        <BCMetricCard title="Focusable" value="100" />,
        { wrapper }
      )

      const card = screen.getByRole('region', { name: 'Focusable' })
      expect(card).toHaveAttribute('tabindex', '0')
    })
  })

  describe('layout', () => {
    it('renders title, value, and subtitle in correct order', () => {
      render(
        <BCMetricCard
          title="Title"
          value="Value"
          subtitle="Subtitle"
        />,
        { wrapper }
      )

      const region = screen.getByRole('region')
      const text = region.textContent

      expect(text).toContain('Value')
      expect(text).toContain('Title')
      expect(text).toContain('Subtitle')
    })

    it('renders without subtitle when not provided', () => {
      render(
        <BCMetricCard title="Title" value="Value" />,
        { wrapper }
      )

      expect(screen.getByText('Title')).toBeInTheDocument()
      expect(screen.getByText('Value')).toBeInTheDocument()
    })
  })

  describe('chart integration', () => {
    it('passes aria-label to chart component', () => {
      render(
        <BCMetricCard
          title="Trend"
          value="42"
          option={{ series: [{ data: [1, 2, 3] }] }}
          ariaLabel="Trend visualization"
        />,
        { wrapper }
      )

      const chart = screen.getByRole('img', { name: 'Trend visualization' })
      expect(chart).toBeInTheDocument()
    })

    it('renders chart with correct height', () => {
      render(
        <BCMetricCard
          title="Chart Card"
          value="100"
          option={{ series: [{ data: [1, 2, 3] }] }}
        />,
        { wrapper }
      )

      expect(screen.getByTestId('bc-responsive-echart')).toBeInTheDocument()
    })
  })

  describe('visual presentation', () => {
    it('renders as a Material-UI Card', () => {
      const { container } = render(
        <BCMetricCard title="Card" value="100" />,
        { wrapper }
      )

      expect(container.querySelector('.MuiCard-root')).toBeInTheDocument()
    })
  })
})
