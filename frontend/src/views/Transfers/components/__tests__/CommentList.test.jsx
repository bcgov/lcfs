import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CommentList } from '../CommentList'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/utils/formatters', () => ({
  formatDateWithTimezoneAbbr: (isoString) => `formatted-${isoString}`
}))

describe('CommentList Component', () => {
  const mockComments = [
    {
      createdBy: 'Alice',
      createdByOrg: 'Some Company',
      createDate: '2023-01-01T00:00:00Z',
      comment: 'Comment from an organization user.'
    },
    {
      createdBy: 'Bob',
      createdByOrg: 'Government of British Columbia',
      createDate: '2023-02-01T00:00:00Z',
      comment: 'Comment from a government user.'
    }
  ]

  it('renders the comment section title from translation keys', () => {
    render(<CommentList comments={mockComments} />, { wrapper })

    expect(screen.getByText('transfer:commentList.title')).toBeInTheDocument()
  })

  it('renders the correct number of comment items', () => {
    render(<CommentList comments={mockComments} />, { wrapper })
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(mockComments.length)
  })

  it('displays no items when the comments array is empty', () => {
    render(<CommentList comments={[]} />, { wrapper })
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('displays userLine for non-gov users and govLine for gov user when viewer is non-gov', () => {
    // viewerIsGovernment defaults to false
    render(<CommentList comments={mockComments} />, { wrapper })

    // For Alice (non-gov author), the text line includes 'transfer:commentList.userLine'
    // For Bob (gov author, viewer non-gov), the text line includes 'transfer:commentList.govLine'
    expect(
      screen.getByText('transfer:commentList.userLine')
    ).toBeInTheDocument()
    expect(screen.getByText('transfer:commentList.govLine')).toBeInTheDocument()
  })

  it('displays userLine for non-gov authors and govLineForGov for gov authors when viewer is gov', () => {
    render(<CommentList comments={mockComments} viewerIsGovernment={true} />, {
      wrapper
    })

    // For Alice (non-gov):
    expect(
      screen.getByText('transfer:commentList.userLine')
    ).toBeInTheDocument()

    // For Bob (gov author, viewer gov): uses 'transfer:commentList.govLineForGov'
    expect(
      screen.getByText('transfer:commentList.govLineForGov')
    ).toBeInTheDocument()
  })

  it('renders correct avatar initials for each comment (non-gov viewer)', () => {
    render(<CommentList comments={mockComments} />, { wrapper })

    // For Alice (non-gov): avatar should be the first letter => "A"
    // For Bob (gov author, viewer is not gov): always "BC"
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('BC')).toBeInTheDocument()
  })

  it('renders correct avatar initials for each comment (gov viewer)', () => {
    render(<CommentList comments={mockComments} viewerIsGovernment={true} />, {
      wrapper
    })

    // For Alice: first letter => "A"
    // For Bob (gov author, viewer is gov): use Bob's actual initials => "B"
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('renders a large number of comments without errors', () => {
    const largeComments = Array.from({ length: 50 }, (_, idx) => ({
      createdBy: `User${idx}`,
      createdByOrg: `Org${idx}`,
      createDate: `2023-01-01T00:00:${idx.toString().padStart(2, '0')}Z`,
      comment: `Comment ${idx}`
    }))
    render(<CommentList comments={largeComments} />, { wrapper })
    expect(screen.getAllByRole('listitem')).toHaveLength(50)
  })

  it('ensures the list has an aria-label for accessibility', () => {
    render(<CommentList comments={mockComments} />, { wrapper })
    expect(screen.getByRole('list')).toHaveAttribute(
      'aria-label',
      'comments section'
    )
  })
})
