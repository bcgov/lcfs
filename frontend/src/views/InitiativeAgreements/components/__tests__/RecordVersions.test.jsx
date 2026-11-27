import 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, vi } from 'vite-plus/test'

import { RecordVersionsTable, VersionHistoryButton } from '../RecordVersions'
import { test } from '@/tests/utils/fixtures'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, values) => (values ? `${key} ${JSON.stringify(values)}` : key)
  })
}))

const mockVersions = vi.fn()
vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useRecordVersions: (...args) => mockVersions(...args)
}))

const versions = [
  {
    version: 0,
    actionType: 'CREATE',
    changeOrderNumber: null,
    values: { name: 'Build the plant', creditAllocation: 1000 },
    isCurrent: false,
    isPending: false
  },
  {
    version: 1,
    actionType: 'UPDATE',
    changeOrderNumber: 1,
    acceptedDate: '2025-12-01',
    values: { name: 'Build the plant', creditAllocation: 1500 },
    isCurrent: true,
    isPending: false
  },
  {
    version: 2,
    actionType: 'UPDATE',
    changeOrderNumber: 2,
    values: { name: 'Build the bigger plant', creditAllocation: 1500 },
    isCurrent: false,
    isPending: true
  }
]

describe('RecordVersionsTable', () => {
  test('shows every version beside the others, marking current and pending', ({
    render,
    app
  }) => {
    render(<RecordVersionsTable versions={versions} />, app)

    expect(screen.getByTestId('record-version-0')).toHaveTextContent(
      'changeOrder.original'
    )
    expect(screen.getByTestId('record-version-1')).toHaveTextContent(
      'changeOrder.current'
    )
    expect(screen.getByTestId('record-version-1')).toHaveTextContent(
      '2025-12-01'
    )
    expect(screen.getByTestId('record-version-2')).toHaveTextContent(
      'changeOrder.pending'
    )
    const table = screen.getByTestId('record-versions-table')
    expect(within(table).getAllByText('1,500')).toHaveLength(2)
    expect(
      within(table).getByText('Build the bigger plant')
    ).toBeInTheDocument()
  })
})

describe('VersionHistoryButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('loads the versions only once opened', async ({ render, app }) => {
    const user = userEvent.setup()
    mockVersions.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false
    })
    render(
      <VersionHistoryButton recordType="designated-action" recordId={12} />,
      app
    )
    expect(mockVersions).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('version-history-designated-action-12'))

    expect(mockVersions).toHaveBeenCalledWith('designated-action', 12)
    expect(screen.getByTestId('record-versions-empty')).toBeInTheDocument()
  })
})
