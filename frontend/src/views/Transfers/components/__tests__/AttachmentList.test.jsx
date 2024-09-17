import React from 'react'
import { render, screen } from '@testing-library/react'
import { AttachmentList } from '../AttachmentList'
import { wrapper } from '@/tests/utils/wrapper'

describe('AttachmentList', () => {
  const mockAttachments = [
    { attachmentID: '1', fileName: 'Document1.pdf' },
    { attachmentID: '2', fileName: 'Image1.png' }
  ]

  test('renders correctly with attachments', () => {
    render(<AttachmentList attachments={mockAttachments} />, { wrapper })
    expect(screen.getByText('Attachments')).toBeInTheDocument()
  })

  test('renders the correct number of attachment items', () => {
    render(<AttachmentList attachments={mockAttachments} />, { wrapper })
    const items = screen.getAllByRole('button')
    expect(items).toHaveLength(mockAttachments.length)
  })

  test('displays the correct file names', () => {
    render(<AttachmentList attachments={mockAttachments} />, { wrapper })
    mockAttachments.forEach((attachment) => {
      expect(screen.getByText(attachment.fileName)).toBeInTheDocument()
    })
  })
})
