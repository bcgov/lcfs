import React from 'react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'

import { DocumentsModellingStep } from '@/views/CarbonIntensity/components/DocumentsModellingStep'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

let mockDocs = []
const mockUpload = vi.fn().mockResolvedValue({})
const mockDelete = vi.fn().mockResolvedValue({})

vi.mock('@/hooks/useDocuments', () => ({
  useDocuments: vi.fn(() => ({ data: mockDocs, isLoading: false })),
  useUploadDocument: vi.fn(() => ({
    mutateAsync: mockUpload,
    isPending: false
  })),
  useDeleteDocument: vi.fn(() => ({
    mutateAsync: mockDelete,
    isPending: false
  }))
}))

const baseCi = { ciApplicationId: 99, supportingDocumentOther: '' }

describe('DocumentsModellingStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDocs = []
  })
  afterEach(cleanup)

  it('renders the upload sections, description input, and Save button', () => {
    render(
      <DocumentsModellingStep
        ciApplication={baseCi}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
      { wrapper }
    )
    expect(
      screen.getByTestId('ci-step3-upload-supporting')
    ).toBeInTheDocument()
    expect(screen.getByTestId('ci-step3-upload-ghgenius')).toBeInTheDocument()
    expect(
      screen.getByTestId('ci-step3-download-template')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('ci-step3-other-description')
    ).toBeInTheDocument()
    expect(screen.getByTestId('ci-step3-save-btn')).toBeInTheDocument()
    expect(screen.getByTestId('ci-step3-delete-btn')).toBeInTheDocument()
  })

  it('disables Save & proceed until both required uploads are present', () => {
    mockDocs = [
      { documentId: 1, fileName: 'x.pdf', fileSize: 100, documentCategory: 'technical_report' }
    ]
    render(
      <DocumentsModellingStep ciApplication={baseCi} onSave={vi.fn()} />,
      { wrapper }
    )
    expect(screen.getByTestId('ci-step3-save-btn')).toBeDisabled()
  })

  it('enables Save & proceed and submits when both required uploads exist', async () => {
    mockDocs = [
      { documentId: 1, fileName: 'tech.pdf', fileSize: 100, documentCategory: 'technical_report' },
      { documentId: 2, fileName: 'model.xlsx', fileSize: 200, documentCategory: 'ghgenius_model' }
    ]
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <DocumentsModellingStep
        ciApplication={{ ...baseCi, supportingDocumentOther: 'CCS notes' }}
        onSave={onSave}
      />,
      { wrapper }
    )
    const btn = screen.getByTestId('ci-step3-save-btn')
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].supportingDocumentOther).toBe('CCS notes')
  })

  it('uploads a chosen file with the selected supporting category', async () => {
    render(
      <DocumentsModellingStep ciApplication={baseCi} onSave={vi.fn()} />,
      { wrapper }
    )
    const file = new File(['hi'], 'tech.pdf', { type: 'application/pdf' })
    const input = screen.getByTestId('ci-step3-supporting-input')
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1))
    expect(mockUpload.mock.calls[0][0].documentCategory).toBe(
      'technical_report'
    )
  })

  it('uploads a GHGenius file with category ghgenius_model', async () => {
    render(
      <DocumentsModellingStep ciApplication={baseCi} onSave={vi.fn()} />,
      { wrapper }
    )
    const file = new File(['hi'], 'model.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    fireEvent.change(screen.getByTestId('ci-step3-ghgenius-input'), {
      target: { files: [file] }
    })
    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1))
    expect(mockUpload.mock.calls[0][0].documentCategory).toBe(
      'ghgenius_model'
    )
  })

  it('rejects an unsupported file type without calling upload', async () => {
    render(
      <DocumentsModellingStep ciApplication={baseCi} onSave={vi.fn()} />,
      { wrapper }
    )
    const file = new File(['hi'], 'bad.exe', {
      type: 'application/x-msdownload'
    })
    fireEvent.change(screen.getByTestId('ci-step3-supporting-input'), {
      target: { files: [file] }
    })
    // Shared validateFile utility surfaces "File type ... is not allowed".
    await waitFor(() =>
      expect(screen.getByText(/is not allowed/i)).toBeInTheDocument()
    )
    expect(mockUpload).not.toHaveBeenCalled()
  })
})
