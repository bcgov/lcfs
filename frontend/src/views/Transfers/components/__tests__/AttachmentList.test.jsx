import React from 'react'
import { screen } from '@testing-library/react'
import { AttachmentList } from '../AttachmentList'
import { test } from '@/tests/utils/fixtures'
import { describe, expect } from 'vitest'

describe('AttachmentList Component', () => {
  const mockAttachments = [
    { attachmentID: '1', fileName: 'Document1.pdf' },
    { attachmentID: '2', fileName: 'Image1.png' }
  ]

  test('renders correctly with attachments', ({ render, app }) => {
    render(<AttachmentList attachments={mockAttachments} />, app)
    expect(screen.getByText('Attachments')).toBeInTheDocument()
  })

  test('renders the correct number of attachment items', ({ render, app }) => {
    render(<AttachmentList attachments={mockAttachments} />, app)
    const items = screen.getAllByRole('button')
    expect(items).toHaveLength(mockAttachments.length)
  })

  test('displays the correct file names', ({ render, app }) => {
    render(<AttachmentList attachments={mockAttachments} />, app)
    mockAttachments.forEach((attachment) => {
      expect(screen.getByText(attachment.fileName)).toBeInTheDocument()
    })
  })

  test('renders an icon for each attachment', ({ render, app }) => {
    render(<AttachmentList attachments={mockAttachments} />, app)
    const icons = screen.getAllByTestId('AttachFileIcon')
    expect(icons).toHaveLength(mockAttachments.length)
  })

  test('handles empty attachments array gracefully', ({ render, app }) => {
    render(<AttachmentList attachments={[]} />, app)
    expect(screen.getByText('Attachments')).toBeInTheDocument()
    const items = screen.queryAllByRole('button')
    expect(items).toHaveLength(0)
  })

  test('renders ListItemButton with component="a"', ({ render, app }) => {
    render(<AttachmentList attachments={mockAttachments} />, app)
    const items = screen.getAllByRole('button')
    items.forEach((item) => {
      expect(item.tagName.toLowerCase()).toBe('a')
    })
  })

  test('renders correctly with long file names', ({ render, app }) => {
    const longFileName =
      'ThisIsAVeryLongFileNameThatShouldBeHandledProperly.txt'
    const attachmentsWithLongName = [
      { attachmentID: '3', fileName: longFileName }
    ]
    render(<AttachmentList attachments={attachmentsWithLongName} />, app)
    expect(screen.getByText(longFileName)).toBeInTheDocument()
  })
})
