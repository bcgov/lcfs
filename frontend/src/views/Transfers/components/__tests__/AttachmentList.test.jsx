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

  test('renders correctly with attachments', ({ render, theme }) => {
    render(<AttachmentList attachments={mockAttachments} />, [theme])
    expect(screen.getByText('Attachments')).toBeInTheDocument()
  })

  test('renders the correct number of attachment items', ({
    render,
    theme
  }) => {
    render(<AttachmentList attachments={mockAttachments} />, [theme])
    const items = screen.getAllByRole('button')
    expect(items).toHaveLength(mockAttachments.length)
  })

  test('displays the correct file names', ({ render, theme }) => {
    render(<AttachmentList attachments={mockAttachments} />, [theme])
    mockAttachments.forEach((attachment) => {
      expect(screen.getByText(attachment.fileName)).toBeInTheDocument()
    })
  })

  test('renders an icon for each attachment', ({ render, theme }) => {
    render(<AttachmentList attachments={mockAttachments} />, [theme])
    const icons = screen.getAllByTestId('AttachFileIcon')
    expect(icons).toHaveLength(mockAttachments.length)
  })

  test('handles empty attachments array gracefully', ({ render, theme }) => {
    render(<AttachmentList attachments={[]} />, [theme])
    expect(screen.getByText('Attachments')).toBeInTheDocument()
    const items = screen.queryAllByRole('button')
    expect(items).toHaveLength(0)
  })

  test('renders ListItemButton with component="a"', ({ render, theme }) => {
    render(<AttachmentList attachments={mockAttachments} />, [theme])
    const items = screen.getAllByRole('button')
    items.forEach((item) => {
      expect(item.tagName.toLowerCase()).toBe('a')
    })
  })

  test('renders correctly with long file names', ({ render, theme }) => {
    const longFileName =
      'ThisIsAVeryLongFileNameThatShouldBeHandledProperly.txt'
    const attachmentsWithLongName = [
      { attachmentID: '3', fileName: longFileName }
    ]
    render(<AttachmentList attachments={attachmentsWithLongName} />, [theme])
    expect(screen.getByText(longFileName)).toBeInTheDocument()
  })
})
