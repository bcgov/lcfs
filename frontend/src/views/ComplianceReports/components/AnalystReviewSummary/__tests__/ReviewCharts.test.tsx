import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReviewCharts } from '../ReviewCharts'
import type { ReviewChartData } from '../types'

const chartProps: any[] = []

vi.mock('echarts-for-react', () => ({
  default: (props: any) => {
    chartProps.push(props)
    return <div data-test="echarts" />
  }
}))

describe('ReviewCharts', () => {
  beforeEach(() => {
    chartProps.length = 0
  })

  it('renders the merged FSE kWh usage and capacity utilization chart as dual axis', () => {
    const chartData: ReviewChartData = {
      historicalVariance: [
        {
          title: 'FSE kWh usage and capacity utilization',
          currentLabel: '2025',
          comparisonLabel: '2024',
          points: [
            {
              label: 'Total kWh usage',
              currentValue: 1200,
              comparisonValue: 1000,
              delta: 200,
              percentChange: 20,
              units: 'kWh'
            },
            {
              label: 'Average capacity utilization',
              currentValue: 0.3,
              comparisonValue: 0.2,
              delta: 0.1,
              percentChange: 50,
              units: '%'
            }
          ]
        }
      ]
    }

    render(<ReviewCharts chartData={chartData} />)

    expect(
      screen.getByText(/FSE kWh usage and capacity utilization/)
    ).toBeInTheDocument()

    const fseOption = chartProps[0].option
    expect(fseOption.yAxis).toHaveLength(2)
    expect(fseOption.yAxis[0].name).toBe('kWh usage')
    expect(fseOption.yAxis[1].name).toBe('Utilization %')
    expect(fseOption.series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Total kWh usage',
          yAxisIndex: 0,
          data: [1000, 1200]
        }),
        expect.objectContaining({
          name: 'Average capacity utilization',
          yAxisIndex: 1,
          data: [0.2, 0.3]
        })
      ])
    )
  })

  it('renders fuel-code sunburst controls and excludes zero-value year leaves', () => {
    const chartData: ReviewChartData = {
      historicalVariance: [
        {
          title: 'Fuel supply by fuel code',
          currentLabel: '2025',
          comparisonLabel: '2024',
          points: [
            {
              label: 'D123 (Diesel - HDRD)',
              currentValue: 500,
              comparisonValue: 0,
              delta: 500,
              units: 'L'
            }
          ]
        }
      ]
    }

    render(<ReviewCharts chartData={chartData} />)

    expect(screen.getByText(/Fuel supply by fuel code/)).toBeInTheDocument()
    expect(screen.getByLabelText('Compliance year')).toBeInTheDocument()
    expect(screen.getByLabelText('Fuel type')).toBeInTheDocument()

    const sunburstOption = chartProps[0].option
    const fuelType = sunburstOption.series[0].data[0]
    expect(fuelType.name).toBe('Diesel - HDRD')
    expect(fuelType.children[0].name).toBe('D123')
    expect(fuelType.children[0].children).toEqual([
      { name: '2025', value: 500 }
    ])
  })

  it('renders compliance units by fuel and schedule as a stacked bar chart', () => {
    const chartData: ReviewChartData = {
      complianceUnitsByFuel: [
        {
          fuelCategory: 'Diesel',
          fuelType: 'HDRD',
          schedule: 'Fuel supply',
          complianceUnits: 120
        },
        {
          fuelCategory: 'Diesel',
          fuelType: 'HDRD',
          schedule: 'Allocation agreements',
          complianceUnits: 40
        }
      ]
    }

    render(<ReviewCharts chartData={chartData} />)

    expect(
      screen.getByText('Compliance units by fuel category, type, and schedule')
    ).toBeInTheDocument()

    const option = chartProps[0].option
    expect(option.xAxis.data).toEqual(['Diesel - HDRD'])
    expect(option.series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Fuel supply',
          stack: 'compliance-units',
          data: [120]
        }),
        expect.objectContaining({
          name: 'Allocation agreements',
          stack: 'compliance-units',
          data: [40]
        })
      ])
    )
  })

  it('does not render when no chart data is available', () => {
    const { container } = render(<ReviewCharts chartData={{}} />)

    expect(container).toBeEmptyDOMElement()
  })
})
