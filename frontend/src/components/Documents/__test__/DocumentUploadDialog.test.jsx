import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog'

import {
  useDeleteDocument,
  useUploadDocument,
  useDocuments
} from '@/hooks/useDocuments'
import { useCurrentUser } from '@/hooks/useCurrentUser'

// Mock hooks
vi.mock('@/hooks/useDocuments', () => ({
  useDocuments: vi.fn(),
  useDeleteDocument: vi.fn(),
  useUploadDocument: vi.fn(),
  useDownloadDocument: vi.fn()
}))
vi.mock('@/hooks/useCurrentUser')

describe('DocumentUploadDialog', () => {
  const parentID = '123'
  const closeMock = vi.fn()

  beforeEach(() => {
    // Mock the hooks with initial values
    useDocuments.mockReturnValue({
      data: [],
      isLoading: false
    })
    useUploadDocument.mockReturnValue({
      mutate: vi.fn()
    })
    useDeleteDocument.mockReturnValue({
      mutate: vi.fn()
    })
    useCurrentUser.mockReturnValue({
      data: { keycloakUsername: 'tester' }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(
      <DocumentUploadDialog
        open={true}
        close={closeMock}
        parentType="report"
        parentID={parentID}
      />,
      { wrapper }
    )
    expect(
      screen.getByText('Add file attachments (maximum file size: 50 MB):')
    ).toBeInTheDocument()
  })

  it('opens file input when card is clicked', () => {
    render(
      <DocumentUploadDialog
        open={true}
        close={closeMock}
        parentType="report"
        parentID={parentID}
      />,
      { wrapper }
    )
    const card = screen.getByRole('button', { name: /upload/i })
    fireEvent.click(card)
    const fileInput = screen.getByTestId('file-input')
    expect(fileInput).toBeInTheDocument()
  })

  it('handles file upload', async () => {
    const uploadFileMock = vi.fn()
    useUploadDocument.mockReturnValue({
      mutate: uploadFileMock
    })

    render(
      <DocumentUploadDialog
        open={true}
        close={closeMock}
        parentType="report"
        parentID={parentID}
      />,
      { wrapper }
    )
    const fileInput = screen.getByTestId('file-input')

    const file = new File(['dummy content'], 'example.txt', {
      type: 'text/plain'
    })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(uploadFileMock).toHaveBeenCalledWith(file, expect.any(Object))
    })
  })

  it('handles file deletion', async () => {
    const deleteFileMock = vi.fn()
    useDeleteDocument.mockReturnValue({
      mutate: deleteFileMock
    })

    useDocuments.mockReturnValue({
      data: [
        {
          documentId: '1',
          fileName: 'example.txt',
          fileSize: 1024,
          createUser: 'tester',
          createDate: '2024-01-01T00:00:00Z'
        }
      ],
      isLoading: false
    })

    render(
      <DocumentUploadDialog
        open={true}
        close={closeMock}
        parentType="report"
        parentID={parentID}
      />,
      { wrapper }
    )
    const deleteButton = screen.getByTestId('delete-button')
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(deleteFileMock).toHaveBeenCalledWith('1')
    })
  })

  it('handles drag and drop', async () => {
    const uploadFileMock = vi.fn()
    useUploadDocument.mockReturnValue({
      mutate: uploadFileMock
    })

    render(
      <DocumentUploadDialog
        open={true}
        close={closeMock}
        parentType="report"
        parentID={parentID}
      />,
      { wrapper }
    )
    const card = screen.getByRole('button', { name: /upload/i })

    const file = new File(['dummy content'], 'example.txt', {
      type: 'text/plain'
    })
    const dataTransfer = {
      items: [
        {
          kind: 'file',
          type: file.type
        }
      ],
      files: [file],
      clearData: vi.fn()
    }

    fireEvent.dragEnter(card, { dataTransfer })
    fireEvent.drop(card, { dataTransfer })

    await waitFor(() => {
      expect(uploadFileMock).toHaveBeenCalledWith(file, expect.any(Object))
    })
  })
})
