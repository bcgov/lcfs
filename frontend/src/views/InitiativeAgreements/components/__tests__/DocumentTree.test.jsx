import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { DocumentTree } from '../DocumentTree'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

const mockTree = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockMove = vi.fn()
const mockUpload = vi.fn()
const mockSoftDelete = vi.fn()
const mockRestoreFolder = vi.fn()
vi.mock('@/hooks/useDocumentFolders', () => ({
  useDocumentTree: () => mockTree(),
  useCreateFolder: () => ({ mutate: mockCreate }),
  useUpdateFolder: () => ({ mutate: mockUpdate }),
  useDeleteFolder: () => ({ mutate: mockDelete }),
  useMoveDocuments: () => ({ mutate: mockMove }),
  useFolderUpload: () => ({ mutate: mockUpload }),
  useSoftDeleteDocument: () => ({ mutate: mockSoftDelete }),
  useDeletedDocuments: () => ({ data: { documents: [], total: 0 } }),
  useRestoreDocument: () => ({ mutate: vi.fn() }),
  useRestoreFolder: () => ({ mutate: mockRestoreFolder })
}))

const mockDownload = vi.fn()
const mockRename = vi.fn()
vi.mock('@/hooks/useDocuments', () => ({
  useDownloadDocument: () => mockDownload,
  useUpdateDocument: () => ({ mutateAsync: mockRename })
}))

const tree = {
  folders: [
    {
      folderId: 12,
      name: 'Permits & Approvals',
      parentFolderId: null,
      sortOrder: 0,
      isSystem: false,
      documentCount: 1,
      documents: [
        {
          documentId: 88,
          fileName: 'permit.pdf',
          fileSize: 46080,
          createDate: '2026-05-12T00:00:00Z',
          createUser: 'LCFS1_bat',
          uploadingOrganizationCode: 'ORG1'
        }
      ],
      children: [
        {
          folderId: 13,
          name: '2026',
          parentFolderId: 12,
          sortOrder: 0,
          isSystem: false,
          documentCount: 0,
          documents: [],
          children: []
        }
      ]
    }
  ],
  rootDocuments: [
    {
      documentId: 90,
      fileName: 'root-letter.pdf',
      fileSize: 2048,
      createDate: '2026-05-13T00:00:00Z',
      createUser: 'IDIRSTAFF'
    }
  ]
}

describe('DocumentTree', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTree.mockReturnValue({ data: tree, isLoading: false })
  })

  it('renders nested folders with counts and files', () => {
    render(<DocumentTree parentType="designatedAction" parentID="9" />, {
      wrapper
    })

    expect(screen.getByText('Permits & Approvals')).toBeInTheDocument()
    expect(screen.getByText('(1)')).toBeInTheDocument()
    expect(screen.getByText('2026')).toBeInTheDocument()
    expect(screen.getByText('permit.pdf')).toBeInTheDocument()
    expect(screen.getByText('root-letter.pdf')).toBeInTheDocument()
  })

  it('downloads a file from its own button', () => {
    render(<DocumentTree parentType="designatedAction" parentID="9" />, {
      wrapper
    })
    fireEvent.click(screen.getByTestId('tree-file-download-88'))
    expect(mockDownload).toHaveBeenCalledWith(88)
  })

  it('lays each file row out in aligned columns', () => {
    render(<DocumentTree parentType="designatedAction" parentID="9" />, {
      wrapper
    })

    const row = screen.getByTestId('tree-file-88')
    // Name, then size, organisation and date in their own lanes, so the
    // columns line up down the list rather than trailing each name.
    expect(row).toHaveTextContent('permit.pdf')
    expect(row).toHaveTextContent('46.1 kB')
    expect(row).toHaveTextContent('ORG1')
  })

  it('titles the section and offers folder creation in its header', () => {
    render(
      <DocumentTree
        parentType="designatedAction"
        parentID="9"
        title="Evidence submissions"
      />,
      { wrapper }
    )

    expect(screen.getByTestId('document-tree-title')).toHaveTextContent(
      'Evidence submissions'
    )
    expect(screen.getByTestId('new-folder-button')).toBeInTheDocument()
  })

  it('renames a file by double-clicking its name', () => {
    render(<DocumentTree parentType="designatedAction" parentID="9" />, {
      wrapper
    })

    fireEvent.doubleClick(screen.getByText('permit.pdf'))
    const input = screen.getByTestId('folder-name-input')
    fireEvent.change(input, { target: { value: 'Signed permit.pdf' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    // A rename only sets display_name; the stored object keeps its key.
    expect(mockRename).toHaveBeenCalledWith({
      documentID: 88,
      data: { displayName: 'Signed permit.pdf' }
    })
  })

  it('offers rename from a real button, not only a double-click', () => {
    render(<DocumentTree parentType="designatedAction" parentID="9" />, {
      wrapper
    })

    // Double-click is a mouse shortcut; a keyboard user needs a control.
    fireEvent.click(screen.getByTestId('tree-file-rename-88'))
    const input = screen.getByTestId('folder-name-input')
    fireEvent.change(input, { target: { value: 'Signed permit.pdf' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockRename).toHaveBeenCalledWith({
      documentID: 88,
      data: { displayName: 'Signed permit.pdf' }
    })
  })

  it('does not rename when the name comes back unchanged', () => {
    render(<DocumentTree parentType="designatedAction" parentID="9" />, {
      wrapper
    })

    fireEvent.doubleClick(screen.getByText('permit.pdf'))
    fireEvent.keyDown(screen.getByTestId('folder-name-input'), { key: 'Enter' })

    expect(mockRename).not.toHaveBeenCalled()
  })

  it('leaves the name alone where renaming is not enabled', () => {
    render(<DocumentTree parentType="initiativeAgreement" parentID="9" />, {
      wrapper
    })

    fireEvent.doubleClick(screen.getByText('permit.pdf'))

    expect(screen.queryByTestId('folder-name-input')).not.toBeInTheDocument()
  })

  it('prefers the display name over the stored file name', () => {
    mockTree.mockReturnValue({
      data: {
        ...tree,
        rootDocuments: [
          { ...tree.rootDocuments[0], displayName: 'Cover letter.pdf' }
        ]
      },
      isLoading: false
    })
    render(<DocumentTree parentType="designatedAction" parentID="9" />, {
      wrapper
    })

    expect(screen.getByText('Cover letter.pdf')).toBeInTheDocument()
    expect(screen.queryByText('root-letter.pdf')).not.toBeInTheDocument()
  })

  it('creates a folder inline with Enter and cancels with Escape', () => {
    render(<DocumentTree parentType="designatedAction" parentID="9" />, {
      wrapper
    })

    fireEvent.click(screen.getByTestId('new-folder-button'))
    const input = screen.getByTestId('folder-name-input')
    fireEvent.change(input, { target: { value: 'Signed agreements' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockCreate).toHaveBeenCalledWith({
      name: 'Signed agreements',
      parentFolderId: null
    })

    fireEvent.click(screen.getByTestId('new-folder-button'))
    const second = screen.getByTestId('folder-name-input')
    fireEvent.keyDown(second, { key: 'Escape' })
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('renames a folder from its menu', () => {
    render(<DocumentTree parentType="designatedAction" parentID="9" />, {
      wrapper
    })

    fireEvent.click(screen.getByTestId('folder-menu-12'))
    fireEvent.click(screen.getByTestId('menu-rename'))
    const input = screen.getByTestId('folder-name-input')
    fireEvent.change(input, { target: { value: 'Approvals' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockUpdate).toHaveBeenCalledWith({ folderId: 12, name: 'Approvals' })
  })

  it('deletes a folder with the default reparent strategy', () => {
    render(<DocumentTree parentType="designatedAction" parentID="9" />, {
      wrapper
    })

    fireEvent.click(screen.getByTestId('folder-menu-12'))
    fireEvent.click(screen.getByTestId('menu-delete'))

    expect(mockDelete).toHaveBeenCalledWith({ folderId: 12 })
  })

  it('creates a subfolder under the menu folder', () => {
    render(<DocumentTree parentType="designatedAction" parentID="9" />, {
      wrapper
    })

    fireEvent.click(screen.getByTestId('folder-menu-12'))
    fireEvent.click(screen.getByTestId('menu-new-subfolder'))
    const input = screen.getByTestId('folder-name-input')
    fireEvent.change(input, { target: { value: 'Evidence' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockCreate).toHaveBeenCalledWith({
      name: 'Evidence',
      parentFolderId: 12
    })
  })

  it('uploads into a folder from the menu', () => {
    render(<DocumentTree parentType="designatedAction" parentID="9" />, {
      wrapper
    })

    fireEvent.click(screen.getByTestId('folder-menu-12'))
    fireEvent.click(screen.getByTestId('menu-upload-here'))

    const input = screen.getByTestId('folder-upload-input')
    const file = new File(['x'], 'evidence.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })

    expect(mockUpload).toHaveBeenCalledWith(
      { files: [file], folderId: 12 },
      expect.anything()
    )
  })

  it('refuses a file the server would reject, naming it and why', () => {
    render(<DocumentTree parentType="designatedAction" parentID="9" />, {
      wrapper
    })

    fireEvent.click(screen.getByTestId('folder-menu-12'))
    fireEvent.click(screen.getByTestId('menu-upload-here'))

    const input = screen.getByTestId('folder-upload-input')
    const file = new File(['x'], 'notes.exe', {
      type: 'application/x-msdownload'
    })
    fireEvent.change(input, { target: { files: [file] } })

    // Refused here rather than after a round trip that was always going
    // to 400.
    expect(mockUpload).not.toHaveBeenCalled()
    expect(screen.getByTestId('upload-error-toast')).toHaveTextContent(
      'notes.exe'
    )
  })

  it('uploads the good files and reports only the bad one', () => {
    render(<DocumentTree parentType="designatedAction" parentID="9" />, {
      wrapper
    })

    fireEvent.click(screen.getByTestId('folder-menu-12'))
    fireEvent.click(screen.getByTestId('menu-upload-here'))

    const good = new File(['x'], 'evidence.pdf', { type: 'application/pdf' })
    const bad = new File(['x'], 'notes.exe', {
      type: 'application/x-msdownload'
    })
    fireEvent.change(screen.getByTestId('folder-upload-input'), {
      target: { files: [good, bad] }
    })

    // One bad file in a batch should not cost the rest their upload.
    expect(mockUpload).toHaveBeenCalledWith(
      { files: [good], folderId: 12 },
      expect.anything()
    )
    expect(screen.getByTestId('upload-error-toast')).toHaveTextContent(
      'notes.exe'
    )
  })

  it('shows an upload in flight on the folder it was dropped on', () => {
    // Held open: the indicator must survive until the mutation settles.
    mockUpload.mockImplementation(() => {})
    render(<DocumentTree parentType="designatedAction" parentID="9" />, {
      wrapper
    })

    const file = new File(['x'], 'evidence.pdf', { type: 'application/pdf' })
    fireEvent.drop(screen.getByTestId('tree-folder-12'), {
      dataTransfer: { types: ['Files'], files: [file] }
    })

    expect(screen.getByTestId('folder-uploading-12')).toBeInTheDocument()
    // And not on a folder nobody dropped on.
    expect(screen.queryByTestId('folder-uploading-13')).not.toBeInTheDocument()
  })

  it('clears the in-flight indicator once the upload settles', () => {
    mockUpload.mockImplementation((_payload, handlers) => handlers.onSettled())
    render(<DocumentTree parentType="designatedAction" parentID="9" />, {
      wrapper
    })

    const file = new File(['x'], 'evidence.pdf', { type: 'application/pdf' })
    fireEvent.drop(screen.getByTestId('tree-folder-12'), {
      dataTransfer: { types: ['Files'], files: [file] }
    })

    expect(screen.queryByTestId('folder-uploading-12')).not.toBeInTheDocument()
  })

  it('surfaces the reason an upload failed', () => {
    mockUpload.mockImplementation((_payload, handlers) => {
      handlers.onError({
        message: 'evidence.pdf: File size exceeds the maximum limit of 50 MB'
      })
      handlers.onSettled()
    })
    render(<DocumentTree parentType="designatedAction" parentID="9" />, {
      wrapper
    })

    const file = new File(['x'], 'evidence.pdf', { type: 'application/pdf' })
    fireEvent.drop(screen.getByTestId('tree-folder-12'), {
      dataTransfer: { types: ['Files'], files: [file] }
    })

    expect(screen.getByTestId('upload-error-toast')).toHaveTextContent(
      'File size exceeds'
    )
  })

  it('asks before moving a file to deleted items', () => {
    render(<DocumentTree parentType="designatedAction" parentID="9" />, {
      wrapper
    })

    fireEvent.click(screen.getByTestId('tree-file-delete-88'))
    // Nothing happens until it is confirmed. (The translation mock in this
    // file drops interpolations, so the body renders its key, not the
    // file name.)
    expect(mockSoftDelete).not.toHaveBeenCalled()
    expect(screen.getByTestId('confirm-delete-body')).toBeInTheDocument()

    fireEvent.click(
      screen.getByText('initiativeAgreement:folders.confirmDelete')
    )
    expect(mockSoftDelete).toHaveBeenCalledWith(88)
  })

  it('shows the empty state', () => {
    mockTree.mockReturnValue({
      data: { folders: [], rootDocuments: [] },
      isLoading: false
    })
    render(<DocumentTree parentType="designatedAction" parentID="9" />, {
      wrapper
    })
    expect(
      screen.getByText('initiativeAgreement:folders.empty')
    ).toBeInTheDocument()
  })
})
