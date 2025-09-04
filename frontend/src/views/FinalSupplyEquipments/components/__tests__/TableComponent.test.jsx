import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ExcelStyledTable } from '../TableComponent'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))

describe('ExcelStyledTable', () => {
  const createMockUnit = (serialNum, hasOverlap, records) => ({
    serialNum,
    hasOverlap,
    records
  })

  const createMockRecord = (uniqueId, fromDate, toDate, hasOverlap = false) => ({
    uniqueId,
    supplyFromDate: fromDate,
    supplyToDate: toDate,
    hasOverlap
  })

  it('renders table structure with headers', () => {
    const uniqueSupplyUnits = {
      s1: createMockUnit('SN1', false, [
        createMockRecord('r1', '2023-01-01', '2023-06-30')
      ])
    }

    render(<ExcelStyledTable uniqueSupplyUnits={uniqueSupplyUnits} overlapMap={{}} />)

    expect(screen.getByText('Serial #')).toBeInTheDocument()
    expect(screen.getByText('Periods')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('renders unit data correctly', () => {
    const uniqueSupplyUnits = {
      s1: createMockUnit('SN001', false, [
        createMockRecord('r1', '2023-01-01', '2023-06-30')
      ])
    }

    render(<ExcelStyledTable uniqueSupplyUnits={uniqueSupplyUnits} overlapMap={{}} />)

    expect(screen.getByText('SN001')).toBeInTheDocument()
    expect(screen.getByText('2023-01-01 → 2023-06-30')).toBeInTheDocument()
  })

  it('displays no overlap status for units without overlap', () => {
    const uniqueSupplyUnits = {
      s1: createMockUnit('SN1', false, [
        createMockRecord('r1', '2023-01-01', '2023-06-30')
      ])
    }

    const { container } = render(
      <ExcelStyledTable uniqueSupplyUnits={uniqueSupplyUnits} overlapMap={{}} />
    )

    expect(screen.getByText('✓ No overlap')).toBeInTheDocument()
    
    const statusCell = screen.getByText('✓ No overlap').closest('td')
    expect(statusCell).toHaveStyle({ color: 'rgb(0, 128, 0)' })
  })

  it('displays overlap status and styling for units with overlap', () => {
    const uniqueSupplyUnits = {
      s1: createMockUnit('SN1', true, [
        createMockRecord('r1', '2023-01-01', '2023-06-30', true)
      ])
    }

    const overlapMap = {
      r1: [{ supplyFromDate: '2023-02-01', supplyToDate: '2023-02-15' }]
    }

    const { container } = render(
      <ExcelStyledTable uniqueSupplyUnits={uniqueSupplyUnits} overlapMap={overlapMap} />
    )

    expect(screen.getByText('⚠️ Period overlap')).toBeInTheDocument()
    
    const statusCell = screen.getByText('⚠️ Period overlap').closest('td')
    expect(statusCell).toHaveStyle({ color: 'rgb(255, 165, 0)' })
  })

  it('applies orange styling to overlapping records in period column', () => {
    const uniqueSupplyUnits = {
      s1: createMockUnit('SN1', false, [
        createMockRecord('r1', '2023-01-01', '2023-06-30', true),
        createMockRecord('r2', '2023-07-01', '2023-12-31', false)
      ])
    }

    const { container } = render(
      <ExcelStyledTable uniqueSupplyUnits={uniqueSupplyUnits} overlapMap={{}} />
    )

    const periodCells = container.querySelectorAll('td')
    const periodCell = Array.from(periodCells).find(
      cell => cell.textContent.includes('2023-01-01 → 2023-06-30') && cell.textContent.includes('2023-07-01 → 2023-12-31')
    )
    
    const periodDivs = periodCell.querySelectorAll('div')
    const overlappingPeriod = Array.from(periodDivs).find(
      div => div.textContent === '2023-01-01 → 2023-06-30'
    )
    const normalPeriod = Array.from(periodDivs).find(
      div => div.textContent === '2023-07-01 → 2023-12-31'
    )

    expect(overlappingPeriod).toHaveStyle({ color: 'rgb(255, 165, 0)' })
    expect(normalPeriod).toHaveStyle({ color: 'inherit' })
  })

  it('sorts records by supply from date chronologically', () => {
    const uniqueSupplyUnits = {
      s1: createMockUnit('SN1', false, [
        createMockRecord('r1', '2023-06-01', '2023-12-31'),
        createMockRecord('r2', '2023-01-01', '2023-05-31'),
        createMockRecord('r3', '2023-03-01', '2023-08-31')
      ])
    }

    render(<ExcelStyledTable uniqueSupplyUnits={uniqueSupplyUnits} overlapMap={{}} />)

    expect(screen.getByText('2023-01-01 → 2023-05-31')).toBeInTheDocument()
    expect(screen.getByText('2023-03-01 → 2023-08-31')).toBeInTheDocument()
    expect(screen.getByText('2023-06-01 → 2023-12-31')).toBeInTheDocument()
  })

  it('renders overlap detail rows when unit has overlap', () => {
    const uniqueSupplyUnits = {
      s1: createMockUnit('SN1', true, [
        createMockRecord('r1', '2023-01-01', '2023-06-30', true)
      ])
    }

    const overlapMap = {
      r1: [
        { supplyFromDate: '2023-02-01', supplyToDate: '2023-02-15' },
        { supplyFromDate: '2023-03-01', supplyToDate: '2023-03-15' }
      ]
    }

    render(
      <ExcelStyledTable uniqueSupplyUnits={uniqueSupplyUnits} overlapMap={overlapMap} />
    )

    expect(screen.getByText('Details for period:')).toBeInTheDocument()
    expect(screen.getByText('⚠️ Overlaps with:')).toBeInTheDocument()
    expect(screen.getByText('Period: 2023-02-01 → 2023-02-15')).toBeInTheDocument()
    expect(screen.getByText('Period: 2023-03-01 → 2023-03-15')).toBeInTheDocument()
  })

  it('does not render detail rows when unit has no overlap', () => {
    const uniqueSupplyUnits = {
      s1: createMockUnit('SN1', false, [
        createMockRecord('r1', '2023-01-01', '2023-06-30')
      ])
    }

    render(<ExcelStyledTable uniqueSupplyUnits={uniqueSupplyUnits} overlapMap={{}} />)

    expect(screen.queryByText('Details for period:')).not.toBeInTheDocument()
    expect(screen.queryByText('⚠️ Overlaps with:')).not.toBeInTheDocument()
  })

  it('filters and shows only overlapping records in detail rows', () => {
    const uniqueSupplyUnits = {
      s1: createMockUnit('SN1', true, [
        createMockRecord('r1', '2023-01-01', '2023-03-31', true),
        createMockRecord('r2', '2023-04-01', '2023-06-30', false),
        createMockRecord('r3', '2023-07-01', '2023-09-30', true)
      ])
    }

    const overlapMap = {
      r1: [{ supplyFromDate: '2023-02-01', supplyToDate: '2023-02-15' }],
      r3: [{ supplyFromDate: '2023-08-01', supplyToDate: '2023-08-15' }]
    }

    render(
      <ExcelStyledTable uniqueSupplyUnits={uniqueSupplyUnits} overlapMap={overlapMap} />
    )

    const detailSections = screen.getAllByText('Details for period:')
    expect(detailSections).toHaveLength(2)
    
    expect(screen.getByText('Period: 2023-02-01 → 2023-02-15')).toBeInTheDocument()
    expect(screen.getByText('Period: 2023-08-01 → 2023-08-15')).toBeInTheDocument()
  })

  it('handles multiple units with mixed overlap status', () => {
    const uniqueSupplyUnits = {
      s1: createMockUnit('SN001', false, [
        createMockRecord('r1', '2023-01-01', '2023-06-30')
      ]),
      s2: createMockUnit('SN002', true, [
        createMockRecord('r2', '2023-01-01', '2023-06-30', true)
      ]),
      s3: createMockUnit('SN003', false, [
        createMockRecord('r3', '2023-07-01', '2023-12-31')
      ])
    }

    const overlapMap = {
      r2: [{ supplyFromDate: '2023-02-01', supplyToDate: '2023-02-15' }]
    }

    render(
      <ExcelStyledTable uniqueSupplyUnits={uniqueSupplyUnits} overlapMap={overlapMap} />
    )

    expect(screen.getByText('SN001')).toBeInTheDocument()
    expect(screen.getByText('SN002')).toBeInTheDocument()
    expect(screen.getByText('SN003')).toBeInTheDocument()

    const noOverlapElements = screen.getAllByText('✓ No overlap')
    const overlapElements = screen.getAllByText('⚠️ Period overlap')
    
    expect(noOverlapElements).toHaveLength(2)
    expect(overlapElements).toHaveLength(1)
  })

  it('handles empty uniqueSupplyUnits', () => {
    render(<ExcelStyledTable uniqueSupplyUnits={{}} overlapMap={{}} />)

    expect(screen.getByText('Serial #')).toBeInTheDocument()
    expect(screen.getByText('Periods')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    
    expect(screen.queryByText('SN')).not.toBeInTheDocument()
  })

  it('handles units with empty records array', () => {
    const uniqueSupplyUnits = {
      s1: createMockUnit('SN001', false, [])
    }

    render(<ExcelStyledTable uniqueSupplyUnits={uniqueSupplyUnits} overlapMap={{}} />)

    expect(screen.getByText('SN001')).toBeInTheDocument()
    expect(screen.getByText('✓ No overlap')).toBeInTheDocument()
  })

  it('handles missing overlapMap entries gracefully', () => {
    const uniqueSupplyUnits = {
      s1: createMockUnit('SN1', false, [
        createMockRecord('r1', '2023-01-01', '2023-06-30')
      ])
    }

    render(<ExcelStyledTable uniqueSupplyUnits={uniqueSupplyUnits} overlapMap={{}} />)

    expect(screen.getByText('SN1')).toBeInTheDocument()
    expect(screen.getByText('✓ No overlap')).toBeInTheDocument()
  })
})