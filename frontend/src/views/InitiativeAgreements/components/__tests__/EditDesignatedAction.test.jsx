import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { EditDesignatedAction } from '../EditDesignatedAction'
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

const mockUpdate = vi.fn()
vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useUpdateDesignatedAction: () => ({ mutate: mockUpdate, isPending: false })
}))

const action = {
  designatedActionId: 9,
  name: 'Comission statoin',
  creditAllocation: 1000,
  specifiedDate: '2026-09-30'
}

const open = () => fireEvent.click(screen.getByTestId('edit-designated-action'))

describe('EditDesignatedAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoles = [roles.ia_analyst]
  })

  it('opens with the current values already filled in', () => {
    render(<EditDesignatedAction action={action} />, { wrapper })
    open()

    expect(screen.getByTestId('edit-action-name')).toHaveValue(
      'Comission statoin'
    )
    expect(screen.getByTestId('edit-action-credits')).toHaveValue(1000)
    expect(screen.getByTestId('edit-action-date')).toHaveValue('2026-09-30')
  })

  it('saves a correction', () => {
    render(<EditDesignatedAction action={action} />, { wrapper })
    open()

    fireEvent.change(screen.getByTestId('edit-action-name'), {
      target: { value: 'Commission station' }
    })
    fireEvent.change(screen.getByTestId('edit-action-credits'), {
      target: { value: '1850' }
    })
    fireEvent.click(screen.getByText('initiativeAgreement:actions.save'))

    expect(mockUpdate).toHaveBeenCalledWith(
      {
        name: 'Commission station',
        creditAllocation: 1850,
        specifiedDate: '2026-09-30'
      },
      expect.anything()
    )
  })

  it('clearing the date asks for it to be cleared, not left alone', () => {
    render(<EditDesignatedAction action={action} />, { wrapper })
    open()

    fireEvent.change(screen.getByTestId('edit-action-date'), {
      target: { value: '' }
    })
    fireEvent.click(screen.getByText('initiativeAgreement:actions.save'))

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ clearSpecifiedDate: true }),
      expect.anything()
    )
  })

  it('will not save a blank name', () => {
    render(<EditDesignatedAction action={action} />, { wrapper })
    open()

    fireEvent.change(screen.getByTestId('edit-action-name'), {
      target: { value: '   ' }
    })
    fireEvent.click(screen.getByText('initiativeAgreement:actions.save'))

    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('surfaces the reason the API refused', () => {
    mockUpdate.mockImplementation((_payload, handlers) =>
      handlers.onError({
        response: { data: { detail: 'Compliance units cannot be negative.' } }
      })
    )
    render(<EditDesignatedAction action={action} />, { wrapper })
    open()
    fireEvent.click(screen.getByText('initiativeAgreement:actions.save'))

    expect(screen.getByTestId('edit-action-error')).toHaveTextContent(
      'cannot be negative'
    )
  })

  it('is absent for a director', () => {
    mockRoles = [roles.director]
    render(<EditDesignatedAction action={action} />, { wrapper })

    expect(
      screen.queryByTestId('edit-designated-action')
    ).not.toBeInTheDocument()
  })
})
