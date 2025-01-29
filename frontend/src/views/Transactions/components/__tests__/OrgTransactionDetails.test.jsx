import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { OrgTransactionDetails } from '@/views/Transactions/components'
import {
  ADMIN_ADJUSTMENT,
  INITIATIVE_AGREEMENT
} from '@/views/Transactions/constants'

// Mock translations using the useTranslation hook
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        'txn:administrativeAdjustment': 'Administrative adjustment',
        'txn:initiativeAgreement': 'Initiative agreement',
        'txn:complianceUnitsLabel': 'Compliance units',
        'txn:effectiveDateLabel': 'Effective date',
        'txn:commentsTextLabel': 'Comments',
        'txn:approvedLabel': 'Approved',
        'txn:approvedByDirector':
          'by the director under the Low Carbon Fuels Act',
        'txn:for': 'for',
        'txn:adminAdjustmentId': 'Administrative adjustment — ID:',
        'txn:initiativeAgreementId': 'Initiative agreement — ID:'
      }
      return translations[key] || key
    }
  })
}))

// Mock BCWidgetCard to avoid errors from nested components
vi.mock('@/components/BCWidgetCard/BCWidgetCard', () => ({
  __esModule: true,
  default: ({ title, content }) => (
    <div data-testid="BCWidgetCard">
      <div>{title}</div>
      <div>{content}</div>
    </div>
  )
}))

// Define mock data for tests
const mockInitiativeAgreementData = {
  complianceUnits: 1,
  currentStatus: {
    initiativeAgreementStatusId: 3,
    status: 'Approved'
  },
  transactionEffectiveDate: '2024-06-04',
  toOrganizationId: 1,
  govComment: null,
  internalComment: null,
  initiativeAgreementId: 1,
  toOrganization: {
    name: 'LCFS Org 1'
  },
  history: [
    {
      createDate: '2024-06-04T13:17:14.253038Z',
      initiativeAgreementStatus: {
        initiativeAgreementStatusId: 2,
        status: 'Recommended'
      },
      userProfile: {
        firstName: 'Hamed',
        lastName: 'Bayeki'
      }
    },
    {
      createDate: '2024-06-04T13:18:17.755851Z',
      initiativeAgreementStatus: {
        initiativeAgreementStatusId: 3,
        status: 'Approved'
      },
      userProfile: {
        firstName: 'Hamed',
        lastName: 'Bayeki'
      }
    }
  ],
  returned: false,
  createDate: '2024-06-04T13:17:14.253038Z'
}

const mockAdminAdjustmentData = {
  complianceUnits: 50000,
  currentStatus: {
    adminAdjustmentStatusId: 3,
    status: 'Approved'
  },
  transactionEffectiveDate: '2023-01-01',
  toOrganizationId: 1,
  govComment: null,
  internalComment: null,
  adminAdjustmentId: 1,
  toOrganization: {
    name: 'LCFS Org 1'
  },
  history: [],
  returned: false,
  createDate: '2024-06-03T21:33:05.526368Z'
}

describe('OrgTransactionDetails Component', () => {
  // Test for rendering initiative agreement transaction details
  it('renders initiative agreement transaction details', () => {
    render(
      <OrgTransactionDetails
        transactionType={INITIATIVE_AGREEMENT}
        transactionData={mockInitiativeAgreementData}
      />
    )

    // Validate the presence of key elements
    expect(
      screen.getByText(/Initiative agreement — ID: IA1/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        (content, element) =>
          element.tagName.toLowerCase() === 'strong' &&
          content.includes('Initiative agreement for LCFS Org 1')
      )
    ).toBeInTheDocument()
    expect(screen.getByText(/Compliance units/)).toBeInTheDocument()
    expect(screen.getAllByText(/1/)).toHaveLength(4)
    expect(screen.getByText(/Effective date/)).toBeInTheDocument()
    expect(screen.getAllByText(/2024-06-04/)).toHaveLength(1)
    expect(screen.getAllByText(/June 4, 2024/)).toHaveLength(1)
    expect(screen.getByText(/Approved/)).toBeInTheDocument()
    expect(
      screen.getByText(/by the director under the Low Carbon Fuels Act/)
    ).toBeInTheDocument()
  })

  // Test for rendering admin adjustment transaction details
  it('renders admin adjustment transaction details', () => {
    render(
      <OrgTransactionDetails
        transactionType={ADMIN_ADJUSTMENT}
        transactionData={mockAdminAdjustmentData}
      />
    )

    // Validate the presence of key elements
    expect(
      screen.getByText(/Administrative adjustment — ID: AA1/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        (content, element) =>
          element.tagName.toLowerCase() === 'strong' &&
          content.includes('Administrative adjustment for LCFS Org 1')
      )
    ).toBeInTheDocument()
    expect(screen.getByText(/Compliance units/)).toBeInTheDocument()
    expect(screen.getByText(/50,000/)).toBeInTheDocument()
    expect(screen.getByText(/Effective date/)).toBeInTheDocument()
    expect(screen.getByText(/2023-01-01/)).toBeInTheDocument()
    expect(screen.getAllByText(/June 3, 2024/)).toHaveLength(1)
    expect(screen.getByText(/Approved/)).toBeInTheDocument()
    expect(
      screen.getByText(/by the director under the Low Carbon Fuels Act/)
    ).toBeInTheDocument()
  })

  // Test for rendering initiative agreement without history
  it('renders initiative agreement without history', () => {
    const transactionDataWithoutHistory = {
      ...mockInitiativeAgreementData,
      history: []
    }

    render(
      <OrgTransactionDetails
        transactionType={INITIATIVE_AGREEMENT}
        transactionData={transactionDataWithoutHistory}
      />
    )

    // Validate the presence of key elements
    expect(
      screen.getByText(/Initiative agreement — ID: IA1/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        (content, element) =>
          element.tagName.toLowerCase() === 'strong' &&
          content.includes('Initiative agreement for LCFS Org 1')
      )
    ).toBeInTheDocument()
    expect(screen.getByText(/Compliance units/)).toBeInTheDocument()
    expect(screen.getAllByText(/1/)).toHaveLength(4)
    expect(screen.getByText(/Effective date/)).toBeInTheDocument()
    expect(screen.getAllByText(/2024-06-04/)).toHaveLength(1)
    expect(screen.getAllByText(/June 4, 2024/)).toHaveLength(1)
    expect(screen.getByText(/Approved/)).toBeInTheDocument()
    expect(
      screen.getByText(/by the director under the Low Carbon Fuels Act/)
    ).toBeInTheDocument()
  })
})
