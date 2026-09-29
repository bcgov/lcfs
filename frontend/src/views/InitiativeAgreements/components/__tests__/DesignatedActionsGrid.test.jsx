import React from 'react'
import { screen } from '@testing-library/react'

import { describe, expect, vi, beforeEach } from 'vitest'

import { DesignatedActionsGrid } from '../DesignatedActionsGrid'
import { test } from '@/tests/utils/fixtures'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

const mockActions = vi.fn()
vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useDesignatedActions: (...args) => mockActions(...args),
  useInitiativeAgreementAnalysts: () => ({ data: [] }),
  useAssignDesignatedActionAnalyst: () => ({ mutate: vi.fn() })
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ hasRoles: () => false })
}))

// The wrapped BCGridViewer needs a heavy AG Grid environment; assert on the
// props contract instead.
const gridProps = vi.fn()
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: (props) => {
    gridProps(props)
    return <div data-test="bc-grid-viewer" />
  }
}))

describe('DesignatedActionsGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActions.mockReturnValue({
      data: {
        designatedActions: [
          {
            designatedActionId: 9,
            actionNumber: 1,
            name: 'Commission station',
            creditAllocation: 1850
          }
        ],
        pagination: { total: 1, page: 1, size: 10, totalPages: 1 }
      },
      isLoading: false,
      isError: false
    })
  })

  test('feeds the grid the paginated designated actions', ({ render, app }) => {
    render(<DesignatedActionsGrid initiativeAgreementId="5" />, app)

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(mockActions).toHaveBeenCalledWith(
      '5',
      expect.objectContaining({ page: 1, size: 10 })
    )
    const props = gridProps.mock.calls[0][0]
    expect(props.dataKey).toBe('designatedActions')
    expect(props.gridKey).toBe('designated-actions-grid')
  })

  test('builds the wireframe ID and credits formats into the column defs', ({
    render,
    app
  }) => {
    render(<DesignatedActionsGrid initiativeAgreementId="5" />, app)

    const props = gridProps.mock.calls[0][0]
    const cols = props.columnDefs
    const idCol = cols.find((c) => c.colId === 'actionNumber')
    expect(idCol.valueGetter({ data: { actionNumber: 2 } })).toBe('DA2-IA5')

    const creditsCol = cols.find((c) => c.field === 'creditAllocation')
    expect(creditsCol.valueFormatter({ value: 1850 })).toBe(
      'initiativeAgreement:actions.upToCredits'
    )

    const rowUrl = props.defaultColDef.cellRendererParams.url({
      data: { designatedActionId: 9 }
    })
    expect(rowUrl).toBe('designated-actions/9')
  })
})
