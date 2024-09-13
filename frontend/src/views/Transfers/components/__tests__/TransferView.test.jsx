import React from 'react'
import { render, screen } from '@testing-library/react'
import { TransferView } from '../TransferView'
import { vi } from 'vitest'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { wrapper } from '@/tests/utils/wrapper'
import { FormProvider, useForm } from 'react-hook-form'
import { TRANSFER_STATUSES } from '@/constants/statuses'

const keycloak = vi.hoisted(() => ({
  useKeycloak: () => ({
    keycloak: vi.fn()
  })
}))
vi.mock('@react-keycloak/web', () => keycloak)

vi.mock('@/hooks/useCurrentUser')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('../TransferDetailsCard', () => ({
  TransferDetailsCard: () => <div>TransferDetailsCard</div>
}))

vi.mock('../CommentList', () => ({
  CommentList: () => <div>CommentList</div>
}))

vi.mock('../Comments', () => ({
  Comments: () => <div>ExternalComments</div>
}))

vi.mock('../InternalComments', () => ({
  default: () => <div>InternalComments</div>
}))

vi.mock('../TransferHistory', () => ({
  default: () => <div>TransferHistory</div>
}))

const MockFormProvider = ({ children }) => {
  const methods = useForm()
  return <FormProvider {...methods}>{children}</FormProvider>
}

describe('TransferView', () => {
  const transferData = {
    currentStatus: { status: TRANSFER_STATUSES.DRAFT },
    toOrganization: { name: 'Org B', organizationId: 2 },
    fromOrganization: { name: 'Org A', organizationId: 1 },
    quantity: 10,
    pricePerUnit: 5,
    comments: [],
    transferHistory: []
  }

  beforeEach(() => {
    useCurrentUser.mockReturnValue({
      sameOrganization: vi.fn(() => true),
      data: {
        isGovernmentUser: false
      }
    })
  })

  test('renders correctly with provided transferData', () => {
    render(
      <MockFormProvider>
        <TransferView
          transferId={1}
          editorMode={false}
          transferData={transferData}
        />
        ,
      </MockFormProvider>,
      { wrapper }
    )

    expect(screen.getByText('Org A')).toBeInTheDocument()
    expect(screen.getByText('Org B')).toBeInTheDocument()
    expect(screen.getByText(/transfer:complianceUnitsTo/i)).toBeInTheDocument()
    expect(screen.getByText(/5.00/i)).toBeInTheDocument()
    expect(screen.getByText(/50.00/i)).toBeInTheDocument() // Total value
  })

  test('displays comments when available', () => {
    transferData.comments = [{ name: 'User1', comment: 'This is a comment.' }]

    render(
      <MockFormProvider>
        <TransferView
          transferId={1}
          editorMode={false}
          transferData={transferData}
        />
      </MockFormProvider>,
      { wrapper }
    )

    expect(screen.getByText('CommentList')).toBeInTheDocument()
  })

  test('hides comments when not available', () => {
    transferData.comments = []

    render(
      <MockFormProvider>
        <TransferView
          transferId={1}
          editorMode={false}
          transferData={transferData}
        />
      </MockFormProvider>,
      { wrapper }
    )

    expect(screen.queryByText('CommentList')).not.toBeInTheDocument()
  })

  test('renders Comments component based on transfer status and user role', () => {
    render(
      <MockFormProvider>
        <TransferView
          transferId={1}
          editorMode={true}
          transferData={transferData}
        />
      </MockFormProvider>,
      { wrapper }
    )

    // Check if Comments component is rendered based on the status
    expect(screen.getByText('ExternalComments')).toBeInTheDocument()
  })

  test('does not render Comments component for terminal statuses', () => {
    transferData.currentStatus.status = TRANSFER_STATUSES.REFUSED // Assuming this is a terminal status

    render(
      <MockFormProvider>
        <TransferView
          transferId={1}
          editorMode={false}
          transferData={transferData}
        />
      </MockFormProvider>,
      { wrapper }
    )

    // Check that Comments component is not rendered
    expect(screen.queryByText('ExternalComments')).not.toBeInTheDocument()
  })
})
