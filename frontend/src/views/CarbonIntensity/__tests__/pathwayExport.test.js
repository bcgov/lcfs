import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'

import { exportRowsToXlsx } from '@/views/CarbonIntensity/components/pathwayExport'

vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: vi.fn((rows) => ({ rows })),
    book_new: vi.fn(() => ({ sheets: [] })),
    book_append_sheet: vi.fn()
  },
  writeFile: vi.fn()
}))

describe('pathwayExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exports visible columns to an xlsx workbook using headers and value getters', () => {
    const rows = [
      { applicationTypeId: 1, feedstock: 'Canola', hidden: 'skip' },
      { applicationTypeId: 2, feedstock: 'Soy', hidden: 'skip' }
    ]
    const columnDefs = [
      {
        field: 'applicationTypeId',
        headerName: 'Application type',
        valueGetter: ({ data }) =>
          data.applicationTypeId === 1 ? 'New' : 'Renewal'
      },
      { field: 'feedstock', headerName: 'Feedstock' },
      { field: 'hidden', headerName: 'Hidden', hide: true }
    ]

    exportRowsToXlsx({
      rows,
      columnDefs,
      fileName: 'ci_application_pathways_10.xlsx',
      sheetName: 'Pathways'
    })

    expect(XLSX.utils.aoa_to_sheet).toHaveBeenCalledWith([
      ['Application type', 'Feedstock'],
      ['New', 'Canola'],
      ['Renewal', 'Soy']
    ])
    expect(XLSX.utils.book_new).toHaveBeenCalled()
    expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith(
      { sheets: [] },
      expect.objectContaining({
        rows: [
          ['Application type', 'Feedstock'],
          ['New', 'Canola'],
          ['Renewal', 'Soy']
        ],
        '!cols': [{ wch: 18 }, { wch: 14 }]
      }),
      'Pathways'
    )
    expect(XLSX.writeFile).toHaveBeenCalledWith(
      { sheets: [] },
      'ci_application_pathways_10.xlsx',
      { bookType: 'xlsx' }
    )
  })

  it('caps generated column widths at 80 characters', () => {
    const longValue = 'x'.repeat(120)

    exportRowsToXlsx({
      rows: [{ feedstock: longValue }],
      columnDefs: [{ field: 'feedstock', headerName: 'Feedstock' }],
      fileName: 'pathways.xlsx',
      sheetName: 'Pathways'
    })

    expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        '!cols': [{ wch: 80 }]
      }),
      'Pathways'
    )
  })
})
