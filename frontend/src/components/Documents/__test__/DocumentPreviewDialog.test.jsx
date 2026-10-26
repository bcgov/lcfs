import { test } from '@/tests/utils/fixtures'
import { screen } from '@testing-library/react'
import { vi, describe, expect, beforeEach } from 'vitest'
import * as XLSX from 'xlsx'
import DocumentPreviewDialog from '../DocumentPreviewDialog'
import { useDownloadDocument, useFetchDocument } from '@/hooks/useDocuments'

vi.mock('@/hooks/useDocuments', () => ({
  useDownloadDocument: vi.fn(),
  useFetchDocument: vi.fn()
}))

const XLSX_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// A real workbook, so the preview goes through the actual SheetJS parser
const buildWorkbook = () => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Fuel', 'Carbon intensity'],
      ['Renewable diesel', 21.5]
    ]),
    'Inputs'
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([['<img src=x onerror=alert(1)>']]),
    'Results'
  )
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
}

describe('DocumentPreviewDialog', () => {
  let fetchDocument

  beforeEach(() => {
    vi.clearAllMocks()
    const bytes = buildWorkbook()
    fetchDocument = vi.fn().mockResolvedValue({
      // jsdom's Blob has no arrayBuffer(), so hand over a blob-like object
      data: { type: XLSX_TYPE, arrayBuffer: async () => bytes },
      headers: { 'content-type': XLSX_TYPE }
    })
    useFetchDocument.mockReturnValue(fetchDocument)
    useDownloadDocument.mockReturnValue(vi.fn())
  })

  test('renders spreadsheet cells and sheet tabs', async ({
    render,
    theme
  }) => {
    render(
      <DocumentPreviewDialog
        open
        onClose={vi.fn()}
        parentType="ci_application"
        parentID={1}
        document={{ documentId: 7, fileName: 'model.xlsx' }}
      />,
      [theme]
    )

    expect(await screen.findByText('Renewable diesel')).toBeInTheDocument()
    expect(screen.getByText('21.5')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Inputs' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Results' })).toBeInTheDocument()
    expect(fetchDocument).toHaveBeenCalledWith(7)
  })

  test('keeps cell text as text, not markup', async ({ render, theme }) => {
    render(
      <DocumentPreviewDialog
        open
        onClose={vi.fn()}
        parentType="ci_application"
        parentID={1}
        document={{ documentId: 7, fileName: 'model.xlsx' }}
      />,
      [theme]
    )

    const resultsTab = await screen.findByRole('tab', { name: 'Results' })
    resultsTab.click()

    expect(
      await screen.findByText('<img src=x onerror=alert(1)>')
    ).toBeInTheDocument()
    expect(document.querySelector('img[src="x"]')).toBeNull()
  })

  test('previews a macro-enabled workbook without running it', async ({
    render,
    theme
  }) => {
    render(
      <DocumentPreviewDialog
        open
        onClose={vi.fn()}
        parentType="ci_application"
        parentID={1}
        document={{ documentId: 7, fileName: 'model.xlsm' }}
      />,
      [theme]
    )

    expect(await screen.findByText('Renewable diesel')).toBeInTheDocument()
  })

  test("shows the server's reason when the file is locked", async ({
    render,
    theme
  }) => {
    const detail =
      'This file contains macros and is waiting for an administrator to approve it.'
    fetchDocument.mockRejectedValue({
      response: {
        status: 409,
        // Blob requests deliver the error body as a Blob
        data: { text: async () => JSON.stringify({ detail }) }
      }
    })

    render(
      <DocumentPreviewDialog
        open
        onClose={vi.fn()}
        parentType="ci_application"
        parentID={1}
        document={{ documentId: 7, fileName: 'model.xlsm' }}
      />,
      [theme]
    )

    expect(await screen.findByText(detail)).toBeInTheDocument()
  })
})
