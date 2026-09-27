import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import axe from 'axe-core'
import { DeletedItems } from '../DeletedItems'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key)
  })
}))

vi.mock('@/utils/formatters', () => ({
  timezoneFormatter: ({ value }) => (value ? '2026-08-26 09:00' : '')
}))

const mockDeleted = vi.fn()
const mockRestore = vi.fn()
const mockRestoreFolder = vi.fn()
vi.mock('@/hooks/useDocumentFolders', () => ({
  useDeletedDocuments: () => mockDeleted(),
  useRestoreDocument: () => ({ mutate: mockRestore }),
  useRestoreFolder: () => ({ mutate: mockRestoreFolder })
}))

const binned = (overrides = {}) => ({
  documentId: 88,
  fileName: 'obsolete.pdf',
  fileSize: 46080,
  deletedDate: '2026-08-26T09:00:00Z',
  deletedBy: 'ALZORKIN',
  deletedByName: 'Alex Zorkin',
  restoreFolderId: 12,
  restoreFolderName: 'Permits',
  ...overrides
})

describe('DeletedItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleted.mockReturnValue({
      data: { documents: [binned()], total: 1 }
    })
  })

  it('shows the count while collapsed', () => {
    render(<DeletedItems parentType="designatedAction" parentID="9" />, {
      wrapper
    })

    expect(screen.getByTestId('deleted-items-count')).toHaveTextContent('1')
    expect(screen.getByTestId('deleted-items-header')).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    // Collapsed by default: the bin is reference, not the main view.
    expect(screen.queryByTestId('deleted-item-88')).not.toBeVisible()
  })

  it('lists what was removed, by whom, and where it returns to', () => {
    render(<DeletedItems parentType="designatedAction" parentID="9" />, {
      wrapper
    })
    fireEvent.click(screen.getByTestId('deleted-items-header'))

    const row = screen.getByTestId('deleted-item-88')
    expect(row).toHaveTextContent('obsolete.pdf')
    expect(row).toHaveTextContent('Alex Zorkin')
    expect(row).toHaveTextContent('folders.restoreTo')
    expect(row).toHaveTextContent('Permits')
  })

  it('says a file returns to the top level when its folder has gone', () => {
    mockDeleted.mockReturnValue({
      data: {
        documents: [binned({ restoreFolderId: null, restoreFolderName: null })],
        total: 1
      }
    })
    render(<DeletedItems parentType="designatedAction" parentID="9" />, {
      wrapper
    })
    fireEvent.click(screen.getByTestId('deleted-items-header'))

    expect(screen.getByTestId('deleted-item-88')).toHaveTextContent(
      'folders.restoreToRoot'
    )
  })

  it('restores a document', () => {
    render(<DeletedItems parentType="designatedAction" parentID="9" />, {
      wrapper
    })
    fireEvent.click(screen.getByTestId('deleted-items-header'))
    fireEvent.click(screen.getByTestId('restore-88'))

    expect(mockRestore).toHaveBeenCalledWith(88)
  })

  it('falls back to the username when no name resolved', () => {
    mockDeleted.mockReturnValue({
      data: { documents: [binned({ deletedByName: null })], total: 1 }
    })
    render(<DeletedItems parentType="designatedAction" parentID="9" />, {
      wrapper
    })
    fireEvent.click(screen.getByTestId('deleted-items-header'))

    expect(screen.getByTestId('deleted-item-88')).toHaveTextContent('ALZORKIN')
  })

  it('shows an empty bin honestly', () => {
    mockDeleted.mockReturnValue({ data: { documents: [], total: 0 } })
    render(<DeletedItems parentType="designatedAction" parentID="9" />, {
      wrapper
    })
    fireEvent.click(screen.getByTestId('deleted-items-header'))

    expect(screen.getByTestId('deleted-items-count')).toHaveTextContent('0')
    expect(
      screen.getByText('initiativeAgreement:folders.binEmpty')
    ).toBeInTheDocument()
  })

  it('toggles from anywhere on the header row, not just the chevron', () => {
    render(<DeletedItems parentType="designatedAction" parentID="9" />, {
      wrapper
    })

    const header = screen.getByTestId('deleted-items-header')
    expect(header).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(header, { key: 'Enter' })
    expect(header).toHaveAttribute('aria-expanded', 'false')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <DeletedItems parentType="designatedAction" parentID="9" />,
      { wrapper }
    )
    fireEvent.click(screen.getByTestId('deleted-items-header'))

    const results = await axe.run(container, {
      rules: {
        'color-contrast': { enabled: false },
        region: { enabled: false }
      }
    })
    expect(results.violations.map((v) => v.id)).toEqual([])
  })
})

describe('DeletedItems folders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleted.mockReturnValue({
      data: {
        documents: [],
        folders: [
          {
            folderId: 12,
            name: 'Permits',
            path: ['Evidence', '2026'],
            documentCount: 3,
            documents: [
              {
                documentId: 1,
                fileName: 'permit.pdf',
                fileSize: 1024,
                relativePath: ''
              },
              {
                documentId: 2,
                fileName: 'site-plan.pdf',
                fileSize: 2048,
                relativePath: 'Drawings'
              },
              {
                documentId: 3,
                fileName: 'elevation.pdf',
                fileSize: 4096,
                relativePath: 'Drawings / North'
              }
            ],
            deletedDate: '2026-08-20T00:00:00Z',
            deletedBy: 'LCFS1_bat',
            deletedByName: 'Bat Analyst'
          },
          {
            folderId: 13,
            name: 'At the top',
            path: [],
            documentCount: 1,
            deletedDate: '2026-08-19T00:00:00Z',
            deletedBy: 'LCFS1_bat',
            deletedByName: 'Bat Analyst'
          }
        ],
        total: 2
      }
    })
  })

  const open = () => fireEvent.click(screen.getByTestId('deleted-items-header'))

  it('lists a deleted folder with what it holds and where it returns to', () => {
    render(<DeletedItems parentType="designatedAction" parentID="9" />, {
      wrapper
    })
    open()

    const row = screen.getByTestId('deleted-folder-12')
    expect(row).toHaveTextContent('Permits')
    expect(row).toHaveTextContent('binFileCount')
    // The path shows where a restore will put it back.
    expect(row).toHaveTextContent('Evidence / 2026')
  })

  it('says a folder returns to the top level when it has no path', () => {
    render(<DeletedItems parentType="designatedAction" parentID="9" />, {
      wrapper
    })
    open()

    expect(screen.getByTestId('deleted-folder-13')).toHaveTextContent(
      'restoreToRoot'
    )
  })

  it('restores a folder', () => {
    render(<DeletedItems parentType="designatedAction" parentID="9" />, {
      wrapper
    })
    open()

    fireEvent.click(screen.getByTestId('restore-folder-12'))

    expect(mockRestoreFolder).toHaveBeenCalledWith(12)
    // A folder restore is its own operation; it must not be routed
    // through the single-document restore.
    expect(mockRestore).not.toHaveBeenCalled()
  })

  it('previews what a folder restore brings back, on request', () => {
    render(<DeletedItems parentType="designatedAction" parentID="9" />, {
      wrapper
    })
    open()

    // Closed by default: the row is a summary, the list is detail.
    expect(
      screen.queryByTestId('deleted-folder-files-12')
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('toggle-folder-files-12'))

    const list = screen.getByTestId('deleted-folder-files-12')
    expect(list).toHaveTextContent('permit.pdf')
    // Nested files show where under the folder they will land.
    expect(list).toHaveTextContent('Drawings / site-plan.pdf')
    expect(list).toHaveTextContent('Drawings / North / elevation.pdf')
    expect(screen.getByTestId('toggle-folder-files-12')).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })

  it('is not empty when only folders are in the bin', () => {
    render(<DeletedItems parentType="designatedAction" parentID="9" />, {
      wrapper
    })
    open()

    expect(
      screen.queryByText('initiativeAgreement:folders.binEmpty')
    ).toBeNull()
  })
})
