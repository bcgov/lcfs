import 'react'
import { describe, expect, vi, beforeEach } from 'vite-plus/test'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { roles } from '@/constants/roles'
import { test } from '@/tests/utils/fixtures'
import { SetUnderwayButton } from '../SetUnderwayButton'

// The test setup stubs BCModal everywhere; this test needs the portal's
// real confirmation modal and its buttons.
vi.unmock('@/components/BCModal')

const MESSAGE =
  'Setting this IA to Underway enables the organization to access this ' +
  'information. No further edits can be made other than by using the ' +
  'Change order process.'

let mockRoles = [{ name: roles.director }]
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: { roles: mockRoles } })
}))

const mockSetUnderway = vi.fn()
vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useSetAgreementUnderway: () => ({ mutateAsync: mockSetUnderway })
}))

const draft = {
  initiativeAgreementId: 5,
  iaCode: 'IA-26ORG1',
  lifecycleStatus: { status: 'Draft' },
  organization: { organizationId: 1, name: 'Test Organization' }
}

const button = () => screen.queryByTestId('set-underway-button')

describe('SetUnderwayButton', () => {
  beforeEach(() => {
    mockRoles = [{ name: roles.director }]
    mockSetUnderway.mockReset()
  })

  test('is offered to a director on a draft', async ({ render, app }) => {
    render(<SetUnderwayButton agreement={draft} />, app)

    expect(await screen.findByTestId('set-underway-button')).toHaveTextContent(
      'Set to Underway'
    )
  })

  test.for(['Underway', 'Completed', 'Terminated'])(
    'is not offered once the agreement is %s',
    (status, { render, app }) => {
      render(
        <SetUnderwayButton
          agreement={{ ...draft, lifecycleStatus: { status } }}
        />,
        app
      )
      expect(button()).not.toBeInTheDocument()
    }
  )

  test.for([
    ['an IA analyst', roles.ia_analyst],
    ['an IA manager', roles.ia_manager],
    ['a government analyst', roles.analyst],
    ['a BCeID proponent', roles.ia_proponent]
  ])('is not offered to %s', ([, role], { render, app }) => {
    mockRoles = [{ name: role }]
    render(<SetUnderwayButton agreement={draft} />, app)
    expect(button()).not.toBeInTheDocument()
  })

  test('is not offered while the agreement has no organization', ({
    render,
    app
  }) => {
    render(
      <SetUnderwayButton agreement={{ ...draft, organization: null }} />,
      app
    )
    expect(button()).not.toBeInTheDocument()
  })

  test('asks for confirmation with the exact message', async ({
    render,
    app
  }) => {
    render(<SetUnderwayButton agreement={draft} />, app)
    fireEvent.click(await screen.findByTestId('set-underway-button'))

    const modal = await screen.findByTestId('modal')
    expect(screen.getByTestId('set-underway-message').textContent).toBe(MESSAGE)
    expect(modal).toHaveTextContent('Set to Underway')
    expect(screen.getByTestId('modal-btn-secondary')).toHaveTextContent(
      'Cancel'
    )
    expect(screen.getByTestId('modal-btn-primary')).toHaveTextContent(
      'Set to Underway'
    )
    expect(mockSetUnderway).not.toHaveBeenCalled()
  })

  test('cancel closes the modal and changes nothing', async ({
    render,
    app
  }) => {
    const onSuccess = vi.fn()
    render(<SetUnderwayButton agreement={draft} onSuccess={onSuccess} />, app)
    fireEvent.click(await screen.findByTestId('set-underway-button'))
    await screen.findByTestId('modal')

    fireEvent.click(screen.getByTestId('modal-btn-secondary'))

    await waitFor(() =>
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    )
    expect(mockSetUnderway).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  test('confirm sets the agreement underway once', async ({ render, app }) => {
    const updated = { ...draft, lifecycleStatus: { status: 'Underway' } }
    mockSetUnderway.mockResolvedValue(updated)
    const onSuccess = vi.fn()
    render(<SetUnderwayButton agreement={draft} onSuccess={onSuccess} />, app)
    fireEvent.click(await screen.findByTestId('set-underway-button'))
    await screen.findByTestId('modal')

    fireEvent.click(screen.getByTestId('modal-btn-primary'))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(updated))
    expect(mockSetUnderway).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    )
  })

  test('reports a refusal and closes the modal', async ({ render, app }) => {
    const refusal = { response: { status: 403 } }
    mockSetUnderway.mockRejectedValue(refusal)
    const onSuccess = vi.fn()
    const onError = vi.fn()
    render(
      <SetUnderwayButton
        agreement={draft}
        onSuccess={onSuccess}
        onError={onError}
      />,
      app
    )
    fireEvent.click(await screen.findByTestId('set-underway-button'))
    await screen.findByTestId('modal')

    fireEvent.click(screen.getByTestId('modal-btn-primary'))

    await waitFor(() => expect(onError).toHaveBeenCalledWith(refusal))
    expect(onSuccess).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    )
  })
})
