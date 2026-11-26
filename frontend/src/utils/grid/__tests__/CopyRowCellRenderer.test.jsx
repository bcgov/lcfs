import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CopyRowCellRenderer } from '../CopyRowCellRenderer'
import { createCopyRowActionColumn } from '../copyRowActionColumn'
import { copyToClipboard } from '@/utils/clipboard'

vi.mock('@/utils/clipboard', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true)
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key, fallback) => fallback })
}))

describe('CopyRowCellRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('copies displayed formatted data values and excludes non-data columns', async () => {
    const node = { id: '123' }
    const getCellValue = vi.fn(
      ({ colKey }) =>
        ({ name: 'Alex Smith', role: 'Administrator, Analyst' })[
          colKey.getColId()
        ]
    )
    const params = {
      node,
      data: {
        id: 123,
        active: false,
        roles: [
          { name: 'Administrator' },
          { name: 'Analyst' },
          { name: 'Government' }
        ]
      },
      copyValueGetters: {
        role: ({ data: rowData }) =>
          rowData.roles
            .map(({ name }) => name)
            .filter((name) => name !== 'Government')
            .join(', '),
        active: ({ data: rowData }) => (rowData.active ? 'Active' : 'Inactive')
      },
      excludedColumns: ['internalAction'],
      api: {
        getCellValue,
        getAllDisplayedColumns: () => [
          { getColId: () => 'name', getColDef: () => ({ headerName: 'Name' }) },
          {
            getColId: () => 'role',
            getColDef: () => ({ headerName: 'Role(s)' })
          },
          {
            getColId: () => 'active',
            getColDef: () => ({ headerName: 'Status' })
          },
          {
            getColId: () => 'internalAction',
            getColDef: () => ({ headerName: 'Action' })
          }
        ]
      }
    }

    render(<CopyRowCellRenderer {...params} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy row' }))

    await waitFor(() =>
      expect(copyToClipboard).toHaveBeenCalledWith(
        'Name: Alex Smith\nRole(s): Administrator, Analyst\nStatus: Inactive'
      )
    )
    expect(getCellValue).toHaveBeenCalledTimes(1)
    expect(getCellValue).toHaveBeenCalledWith({
      rowNode: node,
      colKey: expect.objectContaining({ getColId: expect.any(Function) }),
      useFormatter: true
    })
  })

  it('announces when the clipboard write fails', async () => {
    vi.mocked(copyToClipboard).mockResolvedValueOnce(false)
    const params = {
      node: { id: '1' },
      api: {
        getCellValue: () => 'Sam',
        getAllDisplayedColumns: () => [
          {
            getColId: () => 'name',
            getColDef: () => ({ headerName: 'Name' })
          }
        ]
      }
    }

    render(<CopyRowCellRenderer {...params} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy row' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Could not copy row'
    )
  })

  it('provides a non-data action column that can be reused by grids', () => {
    const column = createCopyRowActionColumn((key) => key)

    expect(column).toMatchObject({
      colId: 'copyRowAction',
      headerName: 'common:action',
      sortable: false,
      filter: false,
      suppressColumnsToolPanel: true
    })
    expect(column.cellRendererParams).toEqual({
      copyValueGetters: {},
      excludedColumns: []
    })
    expect(column.cellRenderer).toBe(CopyRowCellRenderer)
  })
})
