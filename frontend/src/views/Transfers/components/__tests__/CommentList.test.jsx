import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, vi } from 'vitest'
import { CommentList } from '../CommentList'
import { test } from '@/tests/utils/fixtures'

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

  test('renders the comment section title from translation keys', ({
    render,
    theme
  }) => {
    render(<CommentList comments={mockComments} />, [theme])
    expect(screen.getByText('transfer:commentList.title')).toBeInTheDocument()
  })

  test('renders the correct number of comment items', ({ render, theme }) => {
    render(<CommentList comments={mockComments} />, [theme])
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(mockComments.length)
  })

  test('displays no items when the comments array is empty', ({
    render,
    theme
  }) => {
    render(<CommentList comments={[]} />, [theme])
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  test('displays userLine for non-gov users and govLine for gov user when viewer is non-gov', ({
    render,
    theme
  }) => {
    render(<CommentList comments={mockComments} />, [theme])
    expect(
      screen.getByText('transfer:commentList.userLine')
    ).toBeInTheDocument()
    expect(screen.getByText('transfer:commentList.govLine')).toBeInTheDocument()
  })

  test('displays userLine for non-gov authors and govLineForGov for gov authors when viewer is gov', ({
    render,
    theme
  }) => {
    render(<CommentList comments={mockComments} viewerIsGovernment={true} />, [
      theme
    ])
    expect(
      screen.getByText('transfer:commentList.userLine')
    ).toBeInTheDocument()
    expect(
      screen.getByText('transfer:commentList.govLineForGov')
    ).toBeInTheDocument()
  })

  test('renders correct avatar initials for each comment (non-gov viewer)', ({
    render,
    theme
  }) => {
    render(<CommentList comments={mockComments} />, [theme])
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('BC')).toBeInTheDocument()
  })

  test('renders correct avatar initials for each comment (gov viewer)', ({
    render,
    theme
  }) => {
    render(<CommentList comments={mockComments} viewerIsGovernment={true} />, [
      theme
    ])
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  test('renders a large number of comments without errors', ({
    render,
    theme
  }) => {
    const largeComments = Array.from({ length: 50 }, (_, idx) => ({
      createdBy: `User${idx}`,
      createdByOrg: `Org${idx}`,
      createDate: `2023-01-01T00:00:${idx.toString().padStart(2, '0')}Z`,
      comment: `Comment ${idx}`
    }))
    render(<CommentList comments={largeComments} />, [theme])
    expect(screen.getAllByRole('listitem')).toHaveLength(50)
  })

  test('ensures the list has an aria-label for accessibility', ({
    render,
    theme
  }) => {
    render(<CommentList comments={mockComments} />, [theme])
    expect(screen.getByRole('list')).toHaveAttribute(
      'aria-label',
      'comments section'
    )
  })

  // Edge cases for getInitials function coverage
  test('handles users with multiple names correctly in avatars (first + last initials)', ({
    render,
    theme
  }) => {
    const multiNameComments = [
      {
        createdBy: 'John Michael Smith Watson',
        createdByOrg: 'Some Company',
        createDate: '2023-01-01T00:00:00Z',
        comment: 'Multi-name user comment'
      }
    ]
    render(<CommentList comments={multiNameComments} />, [theme])
    expect(screen.getByText('JW')).toBeInTheDocument() // First + Last initials
  })

  test('handles single word names correctly', ({ render, theme }) => {
    const singleNameComments = [
      {
        createdBy: 'Cher',
        createdByOrg: 'Entertainment Inc',
        createDate: '2023-01-01T00:00:00Z',
        comment: 'Single name comment'
      }
    ]
    render(<CommentList comments={singleNameComments} />, [theme])
    expect(screen.getByText('C')).toBeInTheDocument()
  })

  test('handles names with only spaces (returns ? for user initials)', ({
    render,
    theme
  }) => {
    const spacesNameComments = [
      {
        createdBy: '   ',
        createdByOrg: 'Some Company',
        createDate: '2023-01-01T00:00:00Z',
        comment: 'Spaces only name'
      }
    ]
    render(<CommentList comments={spacesNameComments} />, [theme])
    expect(screen.getByText('?')).toBeInTheDocument() // getInitials returns ? for spaces-only name
  })

  // Edge cases for getAvatarLetters function coverage
  test('handles comments without user but with org (orgLine case)', ({
    render,
    theme
  }) => {
    const orgOnlyComments = [
      {
        createdBy: '',
        createdByOrg: 'Some Company',
        createDate: '2023-01-01T00:00:00Z',
        comment: 'Organization comment'
      }
    ]
    render(<CommentList comments={orgOnlyComments} />, [theme])
    expect(screen.getByText('transfer:commentList.orgLine')).toBeInTheDocument()
    expect(screen.getByText('S')).toBeInTheDocument() // First letter of org
  })

  test('handles comments without user and org (fallback case)', ({
    render,
    theme
  }) => {
    const emptyComments = [
      {
        createdBy: '',
        createdByOrg: '',
        createDate: '2023-01-01T00:00:00Z',
        comment: 'Anonymous comment'
      }
    ]
    render(<CommentList comments={emptyComments} />, [theme])
    expect(screen.getByText('?')).toBeInTheDocument() // Fallback avatar
  })

  test('handles undefined createdBy and createdByOrg fields', ({
    render,
    theme
  }) => {
    const undefinedComments = [
      {
        createDate: '2023-01-01T00:00:00Z',
        comment: 'Comment with undefined fields'
      }
    ]
    render(<CommentList comments={undefinedComments} />, [theme])
    expect(screen.getByText('?')).toBeInTheDocument() // Fallback avatar
  })

  // Edge cases for buildLine function coverage
  test('handles government user without username when viewer is government', ({
    render,
    theme
  }) => {
    const govCommentNoUser = [
      {
        createdBy: '',
        createdByOrg: 'Government of British Columbia',
        createDate: '2023-01-01T00:00:00Z',
        comment: 'Gov comment without user'
      }
    ]
    render(
      <CommentList comments={govCommentNoUser} viewerIsGovernment={true} />,
      [theme]
    )
    expect(screen.getByText('transfer:commentList.govLine')).toBeInTheDocument()
    expect(screen.getByText('G')).toBeInTheDocument() // Falls back to first letter of org
  })

  test('handles mixed case organization names', ({ render, theme }) => {
    const mixedCaseComments = [
      {
        createdBy: 'Test User',
        createdByOrg: 'GOVERNMENT OF BRITISH COLUMBIA',
        createDate: '2023-01-01T00:00:00Z',
        comment: 'Mixed case gov org'
      }
    ]
    render(
      <CommentList comments={mixedCaseComments} viewerIsGovernment={false} />,
      [theme]
    )
    expect(screen.getByText('BC')).toBeInTheDocument() // Should still recognize as gov
    expect(screen.getByText('transfer:commentList.govLine')).toBeInTheDocument()
  })

  test('handles lower case government org name', ({ render, theme }) => {
    const lowerCaseComments = [
      {
        createdBy: 'Test User',
        createdByOrg: 'government of british columbia',
        createDate: '2023-01-01T00:00:00Z',
        comment: 'Lower case gov org'
      }
    ]
    render(
      <CommentList comments={lowerCaseComments} viewerIsGovernment={false} />,
      [theme]
    )
    expect(screen.getByText('BC')).toBeInTheDocument()
    expect(screen.getByText('transfer:commentList.govLine')).toBeInTheDocument()
  })

  test('handles undefined comment properties gracefully', ({
    render,
    theme
  }) => {
    const incompleteComments = [
      {
        createdBy: 'Test User',
        createdByOrg: 'Test Org'
        // Missing createDate and comment fields
      }
    ]
    render(<CommentList comments={incompleteComments} />, [theme])
    expect(screen.getByText('TU')).toBeInTheDocument() // Should still show initials
  })

  // Additional edge cases to ensure maximum coverage

  test('handles two-word names correctly', ({ render, theme }) => {
    const twoWordComments = [
      {
        createdBy: 'Jane Doe',
        createdByOrg: 'Test Company',
        createDate: '2023-01-01T00:00:00Z',
        comment: 'Two word name'
      }
    ]
    render(<CommentList comments={twoWordComments} />, [theme])
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  test('handles org name starting with lowercase', ({ render, theme }) => {
    const lowerOrgComments = [
      {
        createdBy: '',
        createdByOrg: 'apple Inc',
        createDate: '2023-01-01T00:00:00Z',
        comment: 'Lowercase org start'
      }
    ]
    render(<CommentList comments={lowerOrgComments} />, [theme])
    expect(screen.getByText('A')).toBeInTheDocument() // Should uppercase the first letter
  })

  test('handles government org with partial match', ({ render, theme }) => {
    const partialGovComments = [
      {
        createdBy: 'Test User',
        createdByOrg: 'Some Government of British Columbia Department',
        createDate: '2023-01-01T00:00:00Z',
        comment: 'Partial gov match'
      }
    ]
    render(
      <CommentList comments={partialGovComments} viewerIsGovernment={false} />,
      [theme]
    )
    expect(screen.getByText('BC')).toBeInTheDocument()
    expect(screen.getByText('transfer:commentList.govLine')).toBeInTheDocument()
  })
})
