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
vi.mock('@/hooks/useDocumentFolders', () => ({
  useDocumentTree: () => mockTree(),
  useCreateFolder: () => ({ mutate: mockCreate }),
  useUpdateFolder: () => ({ mutate: mockUpdate }),
  useDeleteFolder: () => ({ mutate: mockDelete }),
  useMoveDocuments: () => ({ mutate: mockMove }),
  useFolderUpload: () => ({ mutate: mockUpload }),
  useSoftDeleteDocument: () => ({ mutate: mockSoftDelete }),
  useDeletedDocuments: () => ({ data: { documents: [], total: 0 } }),
  useRestoreDocument: () => ({ mutate: vi.fn() })
}))

const mockDownload = vi.fn()
vi.mock('@/hooks/useDocuments', () => ({
  useDownloadDocument: () => mockDownload
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
          createUser: 'LCFS1_bat'
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

  it('downloads a file from its name', () => {
    render(<DocumentTree parentType="designatedAction" parentID="9" />, {
      wrapper
    })
    fireEvent.click(screen.getByText('permit.pdf'))
    expect(mockDownload).toHaveBeenCalledWith(88)
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

    expect(mockUpload).toHaveBeenCalledWith({ files: [file], folderId: 12 })
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
