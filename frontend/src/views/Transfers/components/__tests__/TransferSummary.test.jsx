import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { TransferSummary } from '../TransferSummary'
import { wrapper } from '@/tests/utils/wrapper'

// Mock the utility functions
vi.mock('@/utils/formatters', () => ({
  decimalFormatter: vi.fn((value) => `${value}.00`),
  calculateTotalValue: vi.fn((quantity, price) => quantity * price),
  dateFormatter: vi.fn((date) => `formatted_${date?.toISOString?.()?.split('T')[0] || date}`),
  formatNumberWithCommas: vi.fn(({ value }) => `${value}_formatted`)
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key) => {
      const translations = {
        'transfer:trnsSummary': 'Transfer Summary',
        'transfer:complianceUnitsFrom': 'Compliance units from',
        'transfer:complianceUnitsTo': 'Compliance units to   ',
        'transfer:numberOfUnitsToTrns': 'Number of units to transfer',
        'transfer:valuePerUnit': 'Value per unit',
        'transfer:totalVal': 'Total value',
        'transfer:agreementDt': 'Agreement date',
        'transfer:sendConfirmText': 'Send transfer confirmation to'
      }
      return translations[key] || key
    })
  }))
}))

describe('TransferSummary', () => {
  const mockTransferData = {
    fromOrganization: { name: 'From Organization' },
    toOrganization: { name: 'To Organization' }
  }

  const mockFormData = {
    quantity: 1000,
    pricePerUnit: 25.50,
    agreementDate: new Date('2024-01-15')
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('renders with valid props', () => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={mockFormData}
        />,
        { wrapper }
      )

      expect(screen.getByText('Transfer Summary')).toBeInTheDocument()
      expect(screen.getByText('Compliance units from: From Organization')).toBeInTheDocument()
      expect(screen.getByText('Compliance units to: To Organization')).toBeInTheDocument()
    })

    it('renders with default props', () => {
      render(<TransferSummary />, { wrapper })

      expect(screen.getByText('Transfer Summary')).toBeInTheDocument()
      expect(screen.getByText((content) => content.includes('Compliance units from:'))).toBeInTheDocument()
      expect(screen.getByText((content) => content.includes('Compliance units to:'))).toBeInTheDocument()
    })


    it('renders with empty formData', () => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={{}}
        />,
        { wrapper }
      )

      expect(screen.getByText('Transfer Summary')).toBeInTheDocument()
    })
  })

  describe('Translation Usage', () => {
    it('uses all translation keys correctly', () => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={mockFormData}
        />,
        { wrapper }
      )

      expect(screen.getByText('Transfer Summary')).toBeInTheDocument()
      expect(screen.getByText('Compliance units from: From Organization')).toBeInTheDocument()
      expect(screen.getByText('Compliance units to: To Organization')).toBeInTheDocument()
      expect(screen.getByText('Number of units to transfer: 1000_formatted')).toBeInTheDocument()
      expect(screen.getByText('Value per unit: $25.5.00')).toBeInTheDocument()
      expect(screen.getByText('Total value: $25500.00')).toBeInTheDocument()
      expect(screen.getByText('Agreement date: formatted_2024-01-15')).toBeInTheDocument()
      expect(screen.getByText('Send transfer confirmation toTo Organization?')).toBeInTheDocument()
    })

    it('applies trimEnd to complianceUnitsTo translation', () => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={mockFormData}
        />,
        { wrapper }
      )

      expect(screen.getByText('Compliance units to: To Organization')).toBeInTheDocument()
    })
  })

  describe('Formatter Function Calls', () => {
    it('calls formatNumberWithCommas for quantity', () => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={mockFormData}
        />,
        { wrapper }
      )

      expect(screen.getByText('Number of units to transfer: 1000_formatted')).toBeInTheDocument()
    })

    it('calls decimalFormatter for pricePerUnit', () => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={mockFormData}
        />,
        { wrapper }
      )

      expect(screen.getByText('Value per unit: $25.5.00')).toBeInTheDocument()
    })

    it('calls calculateTotalValue and decimalFormatter for total', () => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={mockFormData}
        />,
        { wrapper }
      )

      expect(screen.getByText('Total value: $25500.00')).toBeInTheDocument()
    })

    it('calls dateFormatter for agreementDate', () => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={mockFormData}
        />,
        { wrapper }
      )

      expect(screen.getByText('Agreement date: formatted_2024-01-15')).toBeInTheDocument()
    })
  })

  describe('Organization Names Display', () => {
    it('displays fromOrganization name correctly', () => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={mockFormData}
        />,
        { wrapper }
      )

      expect(screen.getByText('Compliance units from: From Organization')).toBeInTheDocument()
    })

    it('displays toOrganization name correctly', () => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={mockFormData}
        />,
        { wrapper }
      )

      expect(screen.getByText('Compliance units to: To Organization')).toBeInTheDocument()
      expect(screen.getByText('Send transfer confirmation toTo Organization?')).toBeInTheDocument()
    })

    it('handles empty organization names with defaults', () => {
      render(<TransferSummary />, { wrapper })

      expect(screen.getByText((content) => content.includes('Compliance units from:'))).toBeInTheDocument()
      expect(screen.getByText((content) => content.includes('Compliance units to:'))).toBeInTheDocument()
      expect(screen.getByText((content) => content.includes('Send transfer confirmation to'))).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles zero quantity', () => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={{ ...mockFormData, quantity: 0 }}
        />,
        { wrapper }
      )

      expect(screen.getByText('Number of units to transfer: 0_formatted')).toBeInTheDocument()
    })

    it('handles zero pricePerUnit', () => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={{ ...mockFormData, pricePerUnit: 0 }}
        />,
        { wrapper }
      )

      expect(screen.getByText('Value per unit: $0.00')).toBeInTheDocument()
    })

    it('handles different date formats', () => {
      const testDate = new Date('2023-12-25')

      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={{ ...mockFormData, agreementDate: testDate }}
        />,
        { wrapper }
      )

      expect(screen.getByText('Agreement date: formatted_2023-12-25')).toBeInTheDocument()
    })

    it('renders with missing formData properties', () => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={{}}
        />,
        { wrapper }
      )

      expect(screen.getByText('Transfer Summary')).toBeInTheDocument()
    })

    it('handles undefined formData', () => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={undefined}
        />,
        { wrapper }
      )

      expect(screen.getByText('Transfer Summary')).toBeInTheDocument()
    })
  })

  describe('Default Values', () => {
    it('uses default formData when not provided', () => {
      render(<TransferSummary />, { wrapper })

      expect(screen.getByText('Transfer Summary')).toBeInTheDocument()
      expect(screen.getByText('Number of units to transfer: 0_formatted')).toBeInTheDocument()
      expect(screen.getByText('Value per unit: $0.00')).toBeInTheDocument()
      expect(screen.getByText('Total value: $0.00')).toBeInTheDocument()
    })

    it('handles partial transferData with valid organization', () => {
      render(
        <TransferSummary
          transferData={{ 
            fromOrganization: { name: 'Test From' },
            toOrganization: { name: 'Test To' } 
          }}
          formData={mockFormData}
        />,
        { wrapper }
      )

      expect(screen.getByText('Compliance units from: Test From')).toBeInTheDocument()
      expect(screen.getByText('Compliance units to: Test To')).toBeInTheDocument()
    })

    it('handles partial formData with missing values', () => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={{ quantity: 500 }}
        />,
        { wrapper }
      )

      expect(screen.getByText('Transfer Summary')).toBeInTheDocument()
      expect(screen.getByText('Number of units to transfer: 500_formatted')).toBeInTheDocument()
    })
  })
})
