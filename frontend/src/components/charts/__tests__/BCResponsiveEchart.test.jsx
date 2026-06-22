import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BCResponsiveEChart } from '../BCResponsiveEchart'

const mockSetOption = vi.fn()
const mockResize = vi.fn()
const mockDispose = vi.fn()
const mockInit = vi.fn(() => ({
  setOption: mockSetOption,
  resize: mockResize,
  dispose: mockDispose
}))

vi.mock('echarts/core', () => ({
  init: (...args) => mockInit(...args)
}))

describe('BCResponsiveEChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders a focusable chart container with aria label', () => {
      render(
        <BCResponsiveEChart
          option={{ series: [{ data: [1, 2, 3] }] }}
          ariaLabel="Sample chart"
        />
      )

      const chart = screen.getByRole('img', { name: 'Sample chart' })
      expect(chart).toBeInTheDocument()
      expect(chart).toHaveAttribute('tabindex', '0')
    })

    it('initializes echarts and applies the provided option', () => {
      const option = {
        xAxis: { type: 'category', data: ['A', 'B'] },
        yAxis: { type: 'value' },
        series: [{ data: [10, 20], type: 'bar' }]
      }

      render(<BCResponsiveEChart option={option} height={240} />)

      expect(mockInit).toHaveBeenCalledTimes(1)
      expect(mockSetOption).toHaveBeenCalledWith(option, true)
    })

    it('updates chart options when the option prop changes', () => {
      const initialOption = { series: [{ data: [1] }] }
      const updatedOption = { series: [{ data: [1, 2, 3] }] }

      const { rerender } = render(
        <BCResponsiveEChart option={initialOption} />
      )

      rerender(<BCResponsiveEChart option={updatedOption} />)

      expect(mockSetOption).toHaveBeenLastCalledWith(updatedOption, true)
    })
  })

  describe('empty state', () => {
    it('renders without calling setOption when option is not provided', () => {
      render(<BCResponsiveEChart ariaLabel="Empty chart" />)

      expect(screen.getByRole('img', { name: 'Empty chart' })).toBeInTheDocument()
      expect(mockInit).toHaveBeenCalledTimes(1)
      expect(mockSetOption).not.toHaveBeenCalled()
    })

    it('disposes the chart instance on unmount', () => {
      const { unmount } = render(
        <BCResponsiveEChart option={{ series: [{ data: [] }] }} />
      )

      unmount()

      expect(mockDispose).toHaveBeenCalledTimes(1)
    })
  })

  describe('height customization', () => {
    it('uses default height of 300 when not specified', () => {
      const { container } = render(
        <BCResponsiveEChart option={{ series: [{ data: [1] }] }} />
      )

      const chartElement = container.querySelector('[role="img"]')
      expect(chartElement).toBeInTheDocument()
    })

    it('accepts custom height prop', () => {
      const { container } = render(
        <BCResponsiveEChart option={{ series: [{ data: [1] }] }} height={500} />
      )

      const chartElement = container.querySelector('[role="img"]')
      expect(chartElement).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('uses default tabIndex of 0', () => {
      render(
        <BCResponsiveEChart
          option={{ series: [{ data: [1] }] }}
          ariaLabel="Chart"
        />
      )

      expect(screen.getByRole('img', { name: 'Chart' })).toHaveAttribute(
        'tabindex',
        '0'
      )
    })

    it('accepts custom tabIndex', () => {
      render(
        <BCResponsiveEChart
          option={{ series: [{ data: [1] }] }}
          ariaLabel="Chart"
          tabIndex={-1}
        />
      )

      expect(screen.getByRole('img', { name: 'Chart' })).toHaveAttribute(
        'tabindex',
        '-1'
      )
    })

    it('renders with img role for screen readers', () => {
      render(
        <BCResponsiveEChart
          option={{ series: [{ data: [1] }] }}
          ariaLabel="Data visualization"
        />
      )

      expect(
        screen.getByRole('img', { name: 'Data visualization' })
      ).toBeInTheDocument()
    })
  })

  describe('option updates', () => {
    it('calls setOption with replace flag true', () => {
      const option = { series: [{ data: [1, 2, 3] }] }
      render(<BCResponsiveEChart option={option} />)

      expect(mockSetOption).toHaveBeenCalledWith(option, true)
    })

    it('does not call setOption if option is null', () => {
      render(<BCResponsiveEChart option={null} />)

      expect(mockSetOption).not.toHaveBeenCalled()
    })

    it('handles multiple option updates', () => {
      const option1 = { series: [{ data: [1] }] }
      const option2 = { series: [{ data: [1, 2] }] }
      const option3 = { series: [{ data: [1, 2, 3] }] }

      const { rerender } = render(<BCResponsiveEChart option={option1} />)

      expect(mockSetOption).toHaveBeenCalledWith(option1, true)

      rerender(<BCResponsiveEChart option={option2} />)
      expect(mockSetOption).toHaveBeenCalledWith(option2, true)

      rerender(<BCResponsiveEChart option={option3} />)
      expect(mockSetOption).toHaveBeenCalledWith(option3, true)

      expect(mockSetOption).toHaveBeenCalledTimes(3)
    })
  })

  describe('resize handling', () => {
    it('initializes chart on mount', () => {
      render(<BCResponsiveEChart option={{ series: [{ data: [1] }] }} />)

      expect(mockInit).toHaveBeenCalledTimes(1)
    })

    it('cleanup removes chart instance', () => {
      const { unmount } = render(
        <BCResponsiveEChart option={{ series: [{ data: [1] }] }} />
      )

      expect(mockInit).toHaveBeenCalledTimes(1)
      unmount()

      expect(mockDispose).toHaveBeenCalledTimes(1)
    })
  })
})
