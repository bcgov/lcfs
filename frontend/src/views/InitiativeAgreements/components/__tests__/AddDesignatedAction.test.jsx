import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AddDesignatedAction } from '../AddDesignatedAction'
import { roles } from '@/constants/roles'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

let mockRoles = [roles.ia_analyst]
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { roles: mockRoles.map((name) => ({ name })) },
    hasRoles: (...names) => names.some((n) => mockRoles.includes(n)),
    hasAnyRole: (...names) => names.some((n) => mockRoles.includes(n))
  })
}))

const mockCreate = vi.fn()
vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useCreateDesignatedAction: () => ({
    mutate: mockCreate,
    isPending: false
  })
}))

const open = () => fireEvent.click(screen.getByTestId('add-designated-action'))

describe('AddDesignatedAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoles = [roles.ia_analyst]
  })

  it('offers the control on a draft agreement', () => {
    render(<AddDesignatedAction initiativeAgreementId="1" isDraft />, {
      wrapper
    })

    expect(screen.getByTestId('add-designated-action')).toBeInTheDocument()
  })

  it('is absent once the agreement is no longer a draft', () => {
    render(<AddDesignatedAction initiativeAgreementId="1" isDraft={false} />, {
      wrapper
    })

    expect(
      screen.queryByTestId('add-designated-action')
    ).not.toBeInTheDocument()
  })

  it('is absent for a director, who approves rather than drafts', () => {
    mockRoles = [roles.director]
    render(<AddDesignatedAction initiativeAgreementId="1" isDraft />, {
      wrapper
    })

    expect(
      screen.queryByTestId('add-designated-action')
    ).not.toBeInTheDocument()
  })

  it('will not create an action without a name', () => {
    render(<AddDesignatedAction initiativeAgreementId="1" isDraft />, {
      wrapper
    })
    open()

    // Asserting the behaviour rather than the button's disabled attribute:
    // the modal renders its own controls and the point is that nothing is
    // created from an empty form.
    fireEvent.click(screen.getByText('initiativeAgreement:actions.create'))

    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('creates an action with the details given', () => {
    render(<AddDesignatedAction initiativeAgreementId="1" isDraft />, {
      wrapper
    })
    open()

    fireEvent.change(screen.getByTestId('new-action-name'), {
      target: { value: 'Commission the first station' }
    })
    fireEvent.change(screen.getByTestId('new-action-credits'), {
      target: { value: '1850' }
    })
    fireEvent.change(screen.getByTestId('new-action-date'), {
      target: { value: '2026-09-30' }
    })
    fireEvent.click(screen.getByText('initiativeAgreement:actions.create'))

    expect(mockCreate).toHaveBeenCalledWith(
      {
        name: 'Commission the first station',
        creditAllocation: 1850,
        specifiedDate: '2026-09-30'
      },
      expect.anything()
    )
  })

  it('sends nulls rather than empty strings for the optional fields', () => {
    render(<AddDesignatedAction initiativeAgreementId="1" isDraft />, {
      wrapper
    })
    open()

    fireEvent.change(screen.getByTestId('new-action-name'), {
      target: { value: 'To be decided' }
    })
    fireEvent.click(screen.getByText('initiativeAgreement:actions.create'))

    expect(mockCreate).toHaveBeenCalledWith(
      { name: 'To be decided', creditAllocation: null, specifiedDate: null },
      expect.anything()
    )
  })

  it('surfaces the reason the API refused', () => {
    mockCreate.mockImplementation((_payload, handlers) =>
      handlers.onError({
        response: {
          data: {
            detail:
              'Designated actions can only be added while the agreement is a draft.'
          }
        }
      })
    )
    render(<AddDesignatedAction initiativeAgreementId="1" isDraft />, {
      wrapper
    })
    open()
    fireEvent.change(screen.getByTestId('new-action-name'), {
      target: { value: 'Too late' }
    })
    fireEvent.click(screen.getByText('initiativeAgreement:actions.create'))

    expect(screen.getByTestId('add-action-error')).toHaveTextContent(
      'only be added while the agreement is a draft'
    )
  })
})
