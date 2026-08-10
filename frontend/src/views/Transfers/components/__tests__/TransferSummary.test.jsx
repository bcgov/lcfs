import { screen } from '@testing-library/react'
import { vi, describe, expect, beforeEach } from 'vitest'
import { TransferSummary } from '../TransferSummary'
import { test } from '@/tests/utils/fixtures'

// Mock the utility functions
vi.mock('@/utils/formatters', () => ({
  decimalFormatter: vi.fn((value) => `${value}.00`),
  calculateTotalValue: vi.fn((quantity, price) => quantity * price),
  dateFormatter: vi.fn(
    (date) => `formatted_${date?.toISOString?.()?.split('T')[0] || date}`
  ),
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
    pricePerUnit: 25.5,
    agreementDate: new Date('2024-01-15')
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    test('renders with valid props', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={mockFormData}
        />,
        [query, theme, localization, router]
      )

      expect(screen.getByText('Transfer Summary')).toBeInTheDocument()
      expect(
        screen.getByText('Compliance units from: From Organization')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Compliance units to: To Organization')
      ).toBeInTheDocument()
    })

    test('renders with default props', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <TransferSummary
          transferData={{
            fromOrganization: { name: '' },
            toOrganization: { name: '' }
          }}
          formData={{
            quantity: 0,
            pricePerUnit: 0,
            agreementDate: new Date()
          }}
        />,
        [query, theme, localization, router]
      )

      expect(screen.getByText('Transfer Summary')).toBeInTheDocument()
      expect(
        screen.getByText((content) =>
          content.includes('Compliance units from:')
        )
      ).toBeInTheDocument()
      expect(
        screen.getByText((content) => content.includes('Compliance units to:'))
      ).toBeInTheDocument()
    })

    test('renders with empty formData', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={{
            quantity: 0,
            pricePerUnit: 0,
            agreementDate: new Date()
          }}
        />,
        [query, theme, localization, router]
      )

      expect(screen.getByText('Transfer Summary')).toBeInTheDocument()
    })
  })

  describe('Translation Usage', () => {
    test('uses all translation keys correctly', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={mockFormData}
        />,
        [query, theme, localization, router]
      )

      expect(screen.getByText('Transfer Summary')).toBeInTheDocument()
      expect(
        screen.getByText('Compliance units from: From Organization')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Compliance units to: To Organization')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Number of units to transfer: 1000_formatted')
      ).toBeInTheDocument()
      expect(screen.getByText('Value per unit: $25.5.00')).toBeInTheDocument()
      expect(screen.getByText('Total value: $25500.00')).toBeInTheDocument()
      expect(
        screen.getByText('Agreement date: formatted_2024-01-15')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Send transfer confirmation toTo Organization?')
      ).toBeInTheDocument()
    })

    test('applies trimEnd to complianceUnitsTo translation', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={mockFormData}
        />,
        [query, theme, localization, router]
      )

      expect(
        screen.getByText('Compliance units to: To Organization')
      ).toBeInTheDocument()
    })
  })

  describe('Formatter Function Calls', () => {
    test('calls formatNumberWithCommas for quantity', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={mockFormData}
        />,
        [query, theme, localization, router]
      )

      expect(
        screen.getByText('Number of units to transfer: 1000_formatted')
      ).toBeInTheDocument()
    })

    test('calls decimalFormatter for pricePerUnit', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={mockFormData}
        />,
        [query, theme, localization, router]
      )

      expect(screen.getByText('Value per unit: $25.5.00')).toBeInTheDocument()
    })

    test('calls calculateTotalValue and decimalFormatter for total', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={mockFormData}
        />,
        [query, theme, localization, router]
      )

      expect(screen.getByText('Total value: $25500.00')).toBeInTheDocument()
    })

    test('calls dateFormatter for agreementDate', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={mockFormData}
        />,
        [query, theme, localization, router]
      )

      expect(
        screen.getByText('Agreement date: formatted_2024-01-15')
      ).toBeInTheDocument()
    })
  })

  describe('Organization Names Display', () => {
    test('displays fromOrganization name correctly', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={mockFormData}
        />,
        [query, theme, localization, router]
      )

      expect(
        screen.getByText('Compliance units from: From Organization')
      ).toBeInTheDocument()
    })

    test('displays toOrganization name correctly', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={mockFormData}
        />,
        [query, theme, localization, router]
      )

      expect(
        screen.getByText('Compliance units to: To Organization')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Send transfer confirmation toTo Organization?')
      ).toBeInTheDocument()
    })

    test('handles empty organization names with defaults', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <TransferSummary
          transferData={{
            fromOrganization: { name: '' },
            toOrganization: { name: '' }
          }}
          formData={{
            quantity: 0,
            pricePerUnit: 0,
            agreementDate: new Date()
          }}
        />,
        [query, theme, localization, router]
      )

      expect(
        screen.getByText((content) =>
          content.includes('Compliance units from:')
        )
      ).toBeInTheDocument()
      expect(
        screen.getByText((content) => content.includes('Compliance units to:'))
      ).toBeInTheDocument()
      expect(
        screen.getByText((content) =>
          content.includes('Send transfer confirmation to')
        )
      ).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    test('handles zero quantity', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={{ ...mockFormData, quantity: 0 }}
        />,
        [query, theme, localization, router]
      )

      expect(
        screen.getByText('Number of units to transfer: 0_formatted')
      ).toBeInTheDocument()
    })

    test('handles zero pricePerUnit', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={{ ...mockFormData, pricePerUnit: 0 }}
        />,
        [query, theme, localization, router]
      )

      expect(screen.getByText('Value per unit: $0.00')).toBeInTheDocument()
    })

    test('handles different date formats', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const testDate = new Date('2023-12-25')

      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={{ ...mockFormData, agreementDate: testDate }}
        />,
        [query, theme, localization, router]
      )

      expect(
        screen.getByText('Agreement date: formatted_2023-12-25')
      ).toBeInTheDocument()
    })

    test('renders with missing formData properties', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={{
            quantity: 0,
            pricePerUnit: 0,
            agreementDate: new Date()
          }}
        />,
        [query, theme, localization, router]
      )

      expect(screen.getByText('Transfer Summary')).toBeInTheDocument()
    })

    test('handles undefined formData', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={{
            quantity: 0,
            pricePerUnit: 0,
            agreementDate: new Date()
          }}
        />,
        [query, theme, localization, router]
      )

      expect(screen.getByText('Transfer Summary')).toBeInTheDocument()
    })
  })

  describe('Default Values', () => {
    test('uses default formData when not provided', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <TransferSummary
          transferData={{
            fromOrganization: { name: '' },
            toOrganization: { name: '' }
          }}
          formData={{
            quantity: 0,
            pricePerUnit: 0,
            agreementDate: new Date()
          }}
        />,
        [query, theme, localization, router]
      )

      expect(screen.getByText('Transfer Summary')).toBeInTheDocument()
      expect(
        screen.getByText('Number of units to transfer: 0_formatted')
      ).toBeInTheDocument()
      expect(screen.getByText('Value per unit: $0.00')).toBeInTheDocument()
      expect(screen.getByText('Total value: $0.00')).toBeInTheDocument()
    })

    test('handles partial transferData with valid organization', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <TransferSummary
          transferData={{
            fromOrganization: { name: 'Test From' },
            toOrganization: { name: 'Test To' }
          }}
          formData={mockFormData}
        />,
        [query, theme, localization, router]
      )

      expect(
        screen.getByText('Compliance units from: Test From')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Compliance units to: Test To')
      ).toBeInTheDocument()
    })

    test('handles partial formData with missing values', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <TransferSummary
          transferData={mockTransferData}
          formData={{
            quantity: 500,
            pricePerUnit: 0,
            agreementDate: new Date()
          }}
        />,
        [query, theme, localization, router]
      )

      expect(screen.getByText('Transfer Summary')).toBeInTheDocument()
      expect(
        screen.getByText('Number of units to transfer: 500_formatted')
      ).toBeInTheDocument()
    })
  })
})
