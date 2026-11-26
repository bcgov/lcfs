import 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, vi } from 'vite-plus/test'
import { format, addDays } from 'date-fns'

import { ChangeOrderPanel, StartChangeOrderButton } from '../ChangeOrderPanel'
import { ChangeOrderStateChip } from '../ChangeOrderStateChip'
import { test } from '@/tests/utils/fixtures'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, values) => (values ? `${key} ${JSON.stringify(values)}` : key)
  })
}))

const mockStart = vi.fn()
const mockAccept = vi.fn()
const mockDiscard = vi.fn()
vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useStartChangeOrder: () => ({ mutate: mockStart, isPending: false }),
  useAcceptChangeOrder: () => ({ mutate: mockAccept, isPending: false }),
  useDiscardChangeOrder: () => ({ mutate: mockDiscard, isPending: false })
}))

const underway = (overrides = {}) => ({
  initiativeAgreementId: 7,
  lifecycleStatus: { status: 'Underway' },
  changeOrder: null,
  changeOrderActions: [],
  ...overrides
})

const inChangeOrder = (actions) =>
  underway({
    lifecycleStatus: { status: 'Change order draft' },
    changeOrder: {
      initiativeAgreementChangeOrderId: 3,
      changeOrderNumber: 2,
      status: 'Draft',
      startedByDisplayName: 'Ana Analyst',
      createDate: '2026-11-24T18:00:00Z'
    },
    changeOrderActions: actions
  })

const today = () => format(new Date(), 'yyyy-MM-dd')

describe('ChangeOrderPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders nothing for an organization', ({ render, app }) => {
    // The API gives an organization neither a change order nor an action,
    // even while IDIR drafts one.
    render(
      <>
        <ChangeOrderPanel agreement={underway()} />
        <StartChangeOrderButton agreement={underway()} />
      </>,
      app
    )

    expect(screen.queryByTestId('change-order-panel')).toBeNull()
    expect(screen.queryByTestId('start-change-order')).toBeNull()
  })

  test('starts a change order after confirmation', async ({ render, app }) => {
    const user = userEvent.setup()
    const onNotify = vi.fn()
    mockStart.mockImplementation((_, { onSuccess }) =>
      onSuccess({ changeOrder: { changeOrderNumber: 1 } })
    )
    render(
      <StartChangeOrderButton
        agreement={underway({ changeOrderActions: ['start'] })}
        onNotify={onNotify}
      />,
      app
    )

    await user.click(screen.getByTestId('start-change-order'))
    expect(mockStart).not.toHaveBeenCalled()
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'initiativeAgreement:changeOrder.start'
      })
    )

    expect(mockStart).toHaveBeenCalledTimes(1)
    expect(onNotify).toHaveBeenCalledWith(
      'success',
      expect.stringContaining('changeOrder.started')
    )
  })

  test('shows the draft banner without controls to an analyst', ({
    render,
    app
  }) => {
    render(<ChangeOrderPanel agreement={inChangeOrder([])} />, app)

    expect(screen.getByTestId('change-order-banner')).toHaveTextContent(
      'changeOrder.banner {"number":2}'
    )
    expect(screen.getByTestId('change-order-banner')).toHaveTextContent(
      'Ana Analyst'
    )
    expect(screen.queryByTestId('accept-change-order')).toBeNull()
    expect(screen.queryByTestId('discard-change-order')).toBeNull()
  })

  test('offers a manager Discard only', ({ render, app }) => {
    render(<ChangeOrderPanel agreement={inChangeOrder(['discard'])} />, app)

    expect(screen.getByTestId('discard-change-order')).toBeInTheDocument()
    expect(screen.queryByTestId('accept-change-order')).toBeNull()
  })

  test('the Director accepts with a back-dated accepted date', async ({
    render,
    app
  }) => {
    const user = userEvent.setup()
    mockAccept.mockImplementation((_, { onSuccess }) => onSuccess())
    render(
      <ChangeOrderPanel agreement={inChangeOrder(['accept', 'discard'])} />,
      app
    )

    await user.click(screen.getByTestId('accept-change-order'))
    const dateInput = screen.getByTestId('change-order-accepted-date')
    // Defaults to today and cannot be set past it.
    expect(dateInput).toHaveValue(today())
    expect(dateInput).toHaveAttribute('max', today())
    fireEvent.change(dateInput, { target: { value: '2025-11-03' } })
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'initiativeAgreement:changeOrder.accept'
      })
    )

    expect(mockAccept).toHaveBeenCalledWith(
      { acceptedDate: '2025-11-03' },
      expect.any(Object)
    )
  })

  test('refuses a future accepted date and stays usable', async ({
    render,
    app
  }) => {
    const user = userEvent.setup()
    render(<ChangeOrderPanel agreement={inChangeOrder(['accept'])} />, app)

    await user.click(screen.getByTestId('accept-change-order'))
    fireEvent.change(screen.getByTestId('change-order-accepted-date'), {
      target: { value: format(addDays(new Date(), 1), 'yyyy-MM-dd') }
    })
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'initiativeAgreement:changeOrder.accept'
      })
    )

    expect(mockAccept).not.toHaveBeenCalled()
    expect(screen.getByTestId('change-order-error')).toHaveTextContent(
      'acceptedDateFuture'
    )
    // The dialog is not left busy: it can still be submitted.
    fireEvent.change(screen.getByTestId('change-order-accepted-date'), {
      target: { value: today() }
    })
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'initiativeAgreement:changeOrder.accept'
      })
    )
    expect(mockAccept).toHaveBeenCalledTimes(1)
  })

  test('shows the API error when acceptance fails', async ({ render, app }) => {
    const user = userEvent.setup()
    mockAccept.mockImplementation((_, { onError }) =>
      onError({ response: { data: { detail: 'Agreement code in use.' } } })
    )
    render(<ChangeOrderPanel agreement={inChangeOrder(['accept'])} />, app)

    await user.click(screen.getByTestId('accept-change-order'))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'initiativeAgreement:changeOrder.accept'
      })
    )

    await waitFor(() =>
      expect(screen.getByTestId('change-order-error')).toHaveTextContent(
        'Agreement code in use.'
      )
    )
  })

  test('discards after confirmation', async ({ render, app }) => {
    const user = userEvent.setup()
    render(<ChangeOrderPanel agreement={inChangeOrder(['discard'])} />, app)

    await user.click(screen.getByTestId('discard-change-order'))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'initiativeAgreement:changeOrder.discard'
      })
    )

    expect(mockDiscard).toHaveBeenCalledTimes(1)
  })
})

describe('ChangeOrderStateChip', () => {
  test('labels a record by how it stands in the change order', ({
    render,
    app
  }) => {
    render(<ChangeOrderStateChip state="edited" />, app)

    const chip = screen.getByTestId('change-order-state')
    expect(chip).toHaveAttribute('data-state', 'edited')
    expect(chip).toHaveTextContent('changeOrder.state.edited')
  })

  test('renders nothing outside a change order', ({ render, app }) => {
    render(<ChangeOrderStateChip state={null} />, app)

    expect(screen.queryByTestId('change-order-state')).toBeNull()
  })
})
