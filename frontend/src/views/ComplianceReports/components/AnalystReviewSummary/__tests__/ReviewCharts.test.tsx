import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReviewCharts } from '../ReviewCharts'
import type { ReviewChartData } from '../types'

const chartProps: any[] = []

vi.mock('@/components/charts/BCResponsiveEchart', () => ({
  BCResponsiveEChart: (props: any) => {
    chartProps.push(props)
    return <div data-test="echarts" role="img" aria-label={props.ariaLabel} />
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
      screen.getByLabelText(/FSE kWh usage and capacity utilization/i)
    ).toBeInTheDocument()
    expect(screen.getByText('Total kWh usage')).toBeInTheDocument()
    expect(screen.getByText('Average capacity utilization')).toBeInTheDocument()

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

    expect(
      screen.getByLabelText(/Fuel supply by fuel code/i)
    ).toBeInTheDocument()
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
      screen.getByLabelText(/Compliance units by fuel category, type, and schedule/i)
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

  it('renders the supply and FSE correlation trend as a dual-axis chart', () => {
    const chartData: ReviewChartData = {
      historicalVariance: [
        {
          title: 'Fuel supply and FSE count trend',
          currentLabel: '2025',
          comparisonLabel: '2024',
          points: [
            {
              label: 'Total fuel supply',
              currentValue: 1400000,
              comparisonValue: 1000000,
              delta: 400000,
              percentChange: 40,
              units: 'reported units'
            },
            {
              label: 'FSE count',
              currentValue: 12,
              comparisonValue: 10,
              delta: 2,
              percentChange: 20,
              units: 'count'
            }
          ]
        }
      ]
    }

    render(<ReviewCharts chartData={chartData} />)

    expect(
      screen.getByLabelText(/Fuel supply and FSE count trend/i)
    ).toBeInTheDocument()

    const option = chartProps[0].option
    expect(option.yAxis).toHaveLength(2)
    expect(option.yAxis[0].name).toBe('Supply volume')
    expect(option.yAxis[1].name).toBe('FSE count')
    expect(option.series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Total fuel supply',
          yAxisIndex: 0,
          data: [1000000, 1400000]
        }),
        expect.objectContaining({
          name: 'FSE count',
          yAxisIndex: 1,
          data: [10, 12]
        })
      ])
    )
  })

  it('renders the fuel presence matrix as a heatmap', () => {
    const chartData: ReviewChartData = {
      historicalVariance: [
        {
          title: 'Fuel supply presence by fuel category and type',
          currentLabel: '2025',
          comparisonLabel: '2024',
          points: [
            {
              label: 'Gasoline - Ethanol',
              currentValue: 0,
              comparisonValue: 100,
              delta: -100,
              percentChange: -100,
              units: 'reported units'
            }
          ]
        }
      ]
    }

    render(<ReviewCharts chartData={chartData} />)

    expect(
      screen.getByLabelText(/Fuel supply presence by fuel category and type/i)
    ).toBeInTheDocument()

    const option = chartProps[0].option
    expect(option.series[0].type).toBe('heatmap')
    expect(option.visualMap.text).toEqual(['Higher volume', 'Missing'])
    expect(option.visualMap.dimension).toBe(3)
    expect(option.visualMap.max).toBeCloseTo(Math.log10(101))
    expect(option.series[0].data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: [0, 0, 100, Math.log10(101)]
        }),
        expect.objectContaining({
          value: [1, 0, 0, 0]
        })
      ])
    )
  })

  it('does not render when no chart data is available', () => {
    const { container } = render(<ReviewCharts chartData={{}} />)

    expect(container).toBeEmptyDOMElement()
  })
})
