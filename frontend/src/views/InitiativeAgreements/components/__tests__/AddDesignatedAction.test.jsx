import React from 'react'
import { fireEvent, screen } from '@testing-library/react'

import { describe, expect, vi, beforeEach } from 'vitest'

import { AddDesignatedAction } from '../AddDesignatedAction'
import { roles } from '@/constants/roles'
import { test } from '@/tests/utils/fixtures'

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

  test('offers the control on a draft agreement', ({ render, app }) => {
    render(<AddDesignatedAction initiativeAgreementId="1" isDraft />, app)

    expect(screen.getByTestId('add-designated-action')).toBeInTheDocument()
  })

  test('stays visible but disabled once the agreement is no longer a draft', ({
    render,
    app
  }) => {
    render(
      <AddDesignatedAction initiativeAgreementId="1" isDraft={false} />,
      app
    )

    // Visible so nobody hunts for a button that was never rendered, and
    // the tooltip carries the reason.
    expect(screen.getByTestId('add-designated-action')).toBeDisabled()
    expect(screen.getByTestId('add-designated-action-tip')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('draftOnly')
    )
  })

  test('is absent for a director, who approves rather than drafts', ({
    render,
    app
  }) => {
    mockRoles = [roles.director]
    render(<AddDesignatedAction initiativeAgreementId="1" isDraft />, app)

    expect(
      screen.queryByTestId('add-designated-action')
    ).not.toBeInTheDocument()
  })

  test('will not create an action without a name', ({ render, app }) => {
    render(<AddDesignatedAction initiativeAgreementId="1" isDraft />, app)
    open()

    // Asserting the behaviour rather than the button's disabled attribute:
    // the modal renders its own controls and the point is that nothing is
    // created from an empty form.
    fireEvent.click(screen.getByText('initiativeAgreement:actions.create'))

    expect(mockCreate).not.toHaveBeenCalled()
  })

  test('creates an action with the details given', ({ render, app }) => {
    render(<AddDesignatedAction initiativeAgreementId="1" isDraft />, app)
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

  test('sends nulls rather than empty strings for the optional fields', ({
    render,
    app
  }) => {
    render(<AddDesignatedAction initiativeAgreementId="1" isDraft />, app)
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

  test('refuses a non-numeric credit amount rather than sending it as null', ({
    render,
    app
  }) => {
    // A number input sanitises garbage to '' in a browser, so this cannot
    // happen from a keyboard; the guard is for the day something else
    // feeds the field, when NaN must not slip through as "no allocation".
    render(<AddDesignatedAction initiativeAgreementId="1" isDraft />, app)
    open()

    fireEvent.change(screen.getByTestId('new-action-name'), {
      target: { value: 'Commission the first station' }
    })
    fireEvent.change(screen.getByTestId('new-action-credits'), {
      target: { value: '12.5' }
    })
    fireEvent.click(screen.getByText('initiativeAgreement:actions.create'))

    expect(mockCreate).not.toHaveBeenCalled()
    expect(screen.getByTestId('add-action-error')).toHaveTextContent(
      'invalidCredits'
    )
  })

  test('surfaces the reason the API refused', ({ render, app }) => {
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
    render(<AddDesignatedAction initiativeAgreementId="1" isDraft />, app)
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
