import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CreateAgreement } from '../CreateAgreement'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@/components/Role', () => ({
  Role: ({ children }) => <>{children}</>
}))

vi.mock('@/hooks/useOrganizations', () => ({
  useOrganizationNames: () => ({
    data: [
      { organizationId: 7, name: 'Second Org' },
      { organizationId: 3, name: 'First Org' }
    ],
    isLoading: false
  })
}))

const mockCreate = vi.fn()
vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useCreateAgreement: () => ({ mutate: mockCreate, isPending: false })
}))

const openModal = () => fireEvent.click(screen.getByTestId('create-agreement'))

const pickFirstOrganization = () => {
  const input = screen.getByTestId('create-agreement-org')
  fireEvent.mouseDown(input)
  fireEvent.change(input, { target: { value: 'First' } })
  fireEvent.click(screen.getByText('First Org'))
}

describe('CreateAgreement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('offers the control on the index page', () => {
    render(<CreateAgreement />, { wrapper })

    expect(screen.getByTestId('create-agreement')).toBeInTheDocument()
  })

  it('will not create without an organization and a code', () => {
    render(<CreateAgreement />, { wrapper })
    openModal()

    fireEvent.click(screen.getByText('initiativeAgreement:create.confirm'))

    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('creates a draft from the organization and code alone', () => {
    render(<CreateAgreement />, { wrapper })
    openModal()
    pickFirstOrganization()
    fireEvent.change(screen.getByTestId('create-agreement-code'), {
      target: { value: ' IA-26NEW1 ' }
    })

    fireEvent.click(screen.getByText('initiativeAgreement:create.confirm'))

    // The code is trimmed and the untouched optional fields go as nulls
    // rather than empty strings.
    expect(mockCreate).toHaveBeenCalledWith(
      {
        organizationId: 3,
        iaCode: 'IA-26NEW1',
        agreementType: 'Initiative Agreement',
        title: null,
        agreementStartDate: null,
        agreementEndDate: null
      },
      expect.anything()
    )
  })

  it('lands on the new agreement once it exists', () => {
    mockCreate.mockImplementation((_payload, handlers) =>
      handlers.onSuccess({ initiativeAgreementId: 42, iaCode: 'IA-26NEW1' })
    )
    render(<CreateAgreement />, { wrapper })
    openModal()
    pickFirstOrganization()
    fireEvent.change(screen.getByTestId('create-agreement-code'), {
      target: { value: 'IA-26NEW1' }
    })

    fireEvent.click(screen.getByText('initiativeAgreement:create.confirm'))

    expect(mockNavigate).toHaveBeenCalledWith('42', expect.anything())
  })

  it('surfaces the reason the API refused', () => {
    mockCreate.mockImplementation((_payload, handlers) =>
      handlers.onError({
        response: {
          data: { detail: "Agreement code 'IA-26DEV1' is already in use." }
        }
      })
    )
    render(<CreateAgreement />, { wrapper })
    openModal()
    pickFirstOrganization()
    fireEvent.change(screen.getByTestId('create-agreement-code'), {
      target: { value: 'IA-26DEV1' }
    })

    fireEvent.click(screen.getByText('initiativeAgreement:create.confirm'))

    expect(screen.getByTestId('create-agreement-error')).toHaveTextContent(
      'already in use'
    )
  })
})
