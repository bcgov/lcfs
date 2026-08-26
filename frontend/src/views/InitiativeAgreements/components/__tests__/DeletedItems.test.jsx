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
vi.mock('@/hooks/useDocumentFolders', () => ({
  useDeletedDocuments: () => mockDeleted(),
  useRestoreDocument: () => ({ mutate: mockRestore })
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
