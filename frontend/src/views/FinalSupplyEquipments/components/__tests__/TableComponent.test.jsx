import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ExcelStyledTable } from '../TableComponent'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))

describe('ExcelStyledTable', () => {
  it('renders rows and overlap detail', () => {
    const uniqueSupplyUnits = {
      s1: {
        serialNum: 'SN1',
        hasOverlap: false,
        records: [
          {
            uniqueId: 'r1',
            supplyFromDate: '2023-01-01',
            supplyToDate: '2023-06-30',
            hasOverlap: false
          }
        ]
      },
      s2: {
        serialNum: 'SN2',
        hasOverlap: true,
        records: [
          {
            uniqueId: 'r2',
            supplyFromDate: '2023-01-01',
            supplyToDate: '2023-03-31',
            hasOverlap: true
          }
        ]
      }
    }

    const overlapMap = {
      r2: [{ supplyFromDate: '2023-02-01', supplyToDate: '2023-02-15' }]
    }

    render(
      <ExcelStyledTable
        uniqueSupplyUnits={uniqueSupplyUnits}
        overlapMap={overlapMap}
      />
    )

    expect(screen.getByText('SN1')).toBeInTheDocument()
    expect(screen.getByText('SN2')).toBeInTheDocument()
    expect(screen.getByText(/Period overlap/i)).toBeInTheDocument()
  })
})
