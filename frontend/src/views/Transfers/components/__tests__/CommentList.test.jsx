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

describe('CommentList Component - Full Coverage', () => {
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
    render(<CommentList comments={mockComments} />, { wrapper })
    expect(screen.getByText('transfer:commentList.userLine')).toBeInTheDocument()
    expect(screen.getByText('transfer:commentList.govLine')).toBeInTheDocument()
  })

  it('displays userLine for non-gov authors and govLineForGov for gov authors when viewer is gov', () => {
    render(<CommentList comments={mockComments} viewerIsGovernment={true} />, {
      wrapper
    })
    expect(screen.getByText('transfer:commentList.userLine')).toBeInTheDocument()
    expect(screen.getByText('transfer:commentList.govLineForGov')).toBeInTheDocument()
  })

  it('renders correct avatar initials for each comment (non-gov viewer)', () => {
    render(<CommentList comments={mockComments} />, { wrapper })
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('BC')).toBeInTheDocument()
  })

  it('renders correct avatar initials for each comment (gov viewer)', () => {
    render(<CommentList comments={mockComments} viewerIsGovernment={true} />, {
      wrapper
    })
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

  // Edge cases for getInitials function coverage
  it('handles users with multiple names correctly in avatars (first + last initials)', () => {
    const multiNameComments = [{
      createdBy: 'John Michael Smith Watson',
      createdByOrg: 'Some Company',
      createDate: '2023-01-01T00:00:00Z',
      comment: 'Multi-name user comment'
    }]
    render(<CommentList comments={multiNameComments} />, { wrapper })
    expect(screen.getByText('JW')).toBeInTheDocument() // First + Last initials
  })

  it('handles single word names correctly', () => {
    const singleNameComments = [{
      createdBy: 'Cher',
      createdByOrg: 'Entertainment Inc',
      createDate: '2023-01-01T00:00:00Z',
      comment: 'Single name comment'
    }]
    render(<CommentList comments={singleNameComments} />, { wrapper })
    expect(screen.getByText('C')).toBeInTheDocument()
  })

  it('handles names with only spaces (returns ? for user initials)', () => {
    const spacesNameComments = [{
      createdBy: '   ',
      createdByOrg: 'Some Company',
      createDate: '2023-01-01T00:00:00Z',
      comment: 'Spaces only name'
    }]
    render(<CommentList comments={spacesNameComments} />, { wrapper })
    expect(screen.getByText('?')).toBeInTheDocument() // getInitials returns ? for spaces-only name
  })

  // Edge cases for getAvatarLetters function coverage
  it('handles comments without user but with org (orgLine case)', () => {
    const orgOnlyComments = [{
      createdBy: '',
      createdByOrg: 'Some Company',
      createDate: '2023-01-01T00:00:00Z',
      comment: 'Organization comment'
    }]
    render(<CommentList comments={orgOnlyComments} />, { wrapper })
    expect(screen.getByText('transfer:commentList.orgLine')).toBeInTheDocument()
    expect(screen.getByText('S')).toBeInTheDocument() // First letter of org
  })

  it('handles comments without user and org (fallback case)', () => {
    const emptyComments = [{
      createdBy: '',
      createdByOrg: '',
      createDate: '2023-01-01T00:00:00Z',
      comment: 'Anonymous comment'
    }]
    render(<CommentList comments={emptyComments} />, { wrapper })
    expect(screen.getByText('?')).toBeInTheDocument() // Fallback avatar
  })

  it('handles undefined createdBy and createdByOrg fields', () => {
    const undefinedComments = [{
      createDate: '2023-01-01T00:00:00Z',
      comment: 'Comment with undefined fields'
    }]
    render(<CommentList comments={undefinedComments} />, { wrapper })
    expect(screen.getByText('?')).toBeInTheDocument() // Fallback avatar
  })

  // Edge cases for buildLine function coverage
  it('handles government user without username when viewer is government', () => {
    const govCommentNoUser = [{
      createdBy: '',
      createdByOrg: 'Government of British Columbia',
      createDate: '2023-01-01T00:00:00Z',
      comment: 'Gov comment without user'
    }]
    render(<CommentList comments={govCommentNoUser} viewerIsGovernment={true} />, { wrapper })
    expect(screen.getByText('transfer:commentList.govLine')).toBeInTheDocument()
    expect(screen.getByText('G')).toBeInTheDocument() // Falls back to first letter of org
  })

  it('handles mixed case organization names', () => {
    const mixedCaseComments = [{
      createdBy: 'Test User',
      createdByOrg: 'GOVERNMENT OF BRITISH COLUMBIA',
      createDate: '2023-01-01T00:00:00Z',
      comment: 'Mixed case gov org'
    }]
    render(<CommentList comments={mixedCaseComments} viewerIsGovernment={false} />, { wrapper })
    expect(screen.getByText('BC')).toBeInTheDocument() // Should still recognize as gov
    expect(screen.getByText('transfer:commentList.govLine')).toBeInTheDocument()
  })

  it('handles lower case government org name', () => {
    const lowerCaseComments = [{
      createdBy: 'Test User',
      createdByOrg: 'government of british columbia',
      createDate: '2023-01-01T00:00:00Z',
      comment: 'Lower case gov org'
    }]
    render(<CommentList comments={lowerCaseComments} viewerIsGovernment={false} />, { wrapper })
    expect(screen.getByText('BC')).toBeInTheDocument()
    expect(screen.getByText('transfer:commentList.govLine')).toBeInTheDocument()
  })

  it('handles undefined comment properties gracefully', () => {
    const incompleteComments = [{
      createdBy: 'Test User',
      createdByOrg: 'Test Org'
      // Missing createDate and comment fields
    }]
    render(<CommentList comments={incompleteComments} />, { wrapper })
    expect(screen.getByText('TU')).toBeInTheDocument() // Should still show initials
  })

  // Additional edge cases to ensure maximum coverage

  it('handles two-word names correctly', () => {
    const twoWordComments = [{
      createdBy: 'Jane Doe',
      createdByOrg: 'Test Company',
      createDate: '2023-01-01T00:00:00Z',
      comment: 'Two word name'
    }]
    render(<CommentList comments={twoWordComments} />, { wrapper })
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('handles org name starting with lowercase', () => {
    const lowerOrgComments = [{
      createdBy: '',
      createdByOrg: 'apple Inc',
      createDate: '2023-01-01T00:00:00Z',
      comment: 'Lowercase org start'
    }]
    render(<CommentList comments={lowerOrgComments} />, { wrapper })
    expect(screen.getByText('A')).toBeInTheDocument() // Should uppercase the first letter
  })

  it('handles government org with partial match', () => {
    const partialGovComments = [{
      createdBy: 'Test User',
      createdByOrg: 'Some Government of British Columbia Department',
      createDate: '2023-01-01T00:00:00Z',
      comment: 'Partial gov match'
    }]
    render(<CommentList comments={partialGovComments} viewerIsGovernment={false} />, { wrapper })
    expect(screen.getByText('BC')).toBeInTheDocument()
    expect(screen.getByText('transfer:commentList.govLine')).toBeInTheDocument()
  })
})