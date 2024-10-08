import React from 'react'
import { render, screen } from '@testing-library/react'
import { AttachmentList } from '../AttachmentList'
import { wrapper } from '@/tests/utils/wrapper'
import { describe, expect, it } from 'vitest'

describe('AttachmentList Component', () => {
  const mockAttachments = [
    { attachmentID: '1', fileName: 'Document1.pdf' },
    { attachmentID: '2', fileName: 'Image1.png' }
  ]

  it('renders correctly with attachments', () => {
    render(<AttachmentList attachments={mockAttachments} />, { wrapper })
    expect(screen.getByText('Attachments')).toBeInTheDocument()
  })

  it('renders the correct number of attachment items', () => {
    render(<AttachmentList attachments={mockAttachments} />, { wrapper })
    const items = screen.getAllByRole('button')
    expect(items).toHaveLength(mockAttachments.length)
  })

  it('displays the correct file names', () => {
    render(<AttachmentList attachments={mockAttachments} />, { wrapper })
    mockAttachments.forEach((attachment) => {
      expect(screen.getByText(attachment.fileName)).toBeInTheDocument()
    })
  })

  it('renders an icon for each attachment', () => {
    render(<AttachmentList attachments={mockAttachments} />, { wrapper })
    const icons = screen.getAllByTestId('AttachFileIcon')
    expect(icons).toHaveLength(mockAttachments.length)
  })

  it('handles empty attachments array gracefully', () => {
    render(<AttachmentList attachments={[]} />, { wrapper })
    expect(screen.getByText('Attachments')).toBeInTheDocument()
    const items = screen.queryAllByRole('button')
    expect(items).toHaveLength(0)
  })

  it('renders ListItemButton with component="a"', () => {
    render(<AttachmentList attachments={mockAttachments} />, { wrapper })
    const items = screen.getAllByRole('button')
    items.forEach((item) => {
      expect(item.tagName.toLowerCase()).toBe('a')
    })
  })

  it('renders correctly with long file names', () => {
    const longFileName = 'ThisIsAVeryLongFileNameThatShouldBeHandledProperly.txt'
    const attachmentsWithLongName = [
      { attachmentID: '3', fileName: longFileName }
    ]
    render(<AttachmentList attachments={attachmentsWithLongName} />, { wrapper })
    expect(screen.getByText(longFileName)).toBeInTheDocument()
  })
})
