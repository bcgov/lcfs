import React from 'react'
import { render, screen } from '@testing-library/react'
import { TransferSummary } from '../TransferSummary'
import { vi } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/utils/formatters', () => ({
  decimalFormatter: vi.fn((value) => value.toFixed(2)),
  calculateTotalValue: vi.fn(
    (quantity, pricePerUnit) => quantity * pricePerUnit
  ),
  dateFormatter: vi.fn((date) => '2022-12-31')
}))

describe('TransferSummary Component', () => {
  const transferData = {
    fromOrganization: { name: 'Org A' },
    toOrganization: { name: 'Org B' }
  }

  const formData = {
    quantity: 10,
    pricePerUnit: 5,
    agreementDate: new Date('2023-01-01')
  }

  test('renders correctly with provided transferData and formData', () => {
    render(
      <TransferSummary transferData={transferData} formData={formData} />,
      {
        wrapper
      }
    )

    expect(screen.getByText('transfer:trnsSummary')).toBeInTheDocument()
    expect(
      screen.getByText('transfer:complianceUnitsFrom: Org A')
    ).toBeInTheDocument()
    expect(
      screen.getByText('transfer:complianceUnitsTo: Org B')
    ).toBeInTheDocument()
    expect(
      screen.getByText('transfer:numberOfUnitsToTrns: 10')
    ).toBeInTheDocument()
    expect(screen.getByText('transfer:valuePerUnit: $5.00')).toBeInTheDocument()
    expect(screen.getByText('transfer:totalVal: $50.00')).toBeInTheDocument() // 10 * 5 = 50
    expect(
      screen.getByText('transfer:agreementDt: 2022-12-31')
    ).toBeInTheDocument() // Date formatted
  })
})
