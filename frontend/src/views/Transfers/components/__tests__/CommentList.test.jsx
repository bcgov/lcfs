import React from 'react'
import { render, screen } from '@testing-library/react'
import { CommentList } from '../CommentList'
import { wrapper } from '@/tests/utils/wrapper'
import { describe, expect, it } from 'vitest'

describe('CommentList Component', () => {
  const mockComments = [
    { name: 'Alice', comment: 'This is a comment.' },
    { name: 'Bob', comment: 'Thanks for sharing!' }
  ]

  it('renders correctly with comments', () => {
    render(<CommentList comments={mockComments} />, { wrapper })
    expect(screen.getByText('Comments')).toBeInTheDocument()
    expect(screen.getByLabelText('comments section')).toBeInTheDocument()
  })

  it('renders the correct number of comment items', () => {
    render(<CommentList comments={mockComments} />, { wrapper })
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(mockComments.length)
  })

  it('displays the correct names and comments', () => {
    render(<CommentList comments={mockComments} />, { wrapper })
    mockComments.forEach((comment) => {
      expect(screen.getByText(`${comment.name}:`)).toBeInTheDocument()
      expect(screen.getByText(comment.comment)).toBeInTheDocument()
    })
  })

  it('renders correctly with empty comments array', () => {
    render(<CommentList comments={[]} />, { wrapper })
    expect(screen.getByText('Comments')).toBeInTheDocument()
    const items = screen.queryAllByRole('listitem')
    expect(items).toHaveLength(0)
  })

  it('renders correctly with a large number of comments', () => {
    const largeComments = Array.from({ length: 100 }, (_, idx) => ({
      name: `User ${idx}`,
      comment: `Comment ${idx}`
    }))
    render(<CommentList comments={largeComments} />, { wrapper })
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(largeComments.length)
  })

  it('displays special characters and escapes HTML tags in comments', () => {
    const specialComments = [
      { name: 'Charlie', comment: '<script>alert("XSS")</script>' },
      { name: 'Dana', comment: 'Special characters !@#$%^&*()' }
    ]
    render(<CommentList comments={specialComments} />, { wrapper })
    specialComments.forEach((comment) => {
      expect(screen.getByText(`${comment.name}:`)).toBeInTheDocument()
      expect(screen.getByText(comment.comment)).toBeInTheDocument()
    })
  })

  it('renders avatar initials correctly', () => {
    render(<CommentList comments={mockComments} />, { wrapper })
    mockComments.forEach((comment) => {
      const avatarInitial = comment.name.charAt(0)
      expect(screen.getAllByText(avatarInitial)).toBeTruthy()
    })
  })

  it('ensures accessibility attributes are present', () => {
    render(<CommentList comments={mockComments} />, { wrapper })
    const list = screen.getByRole('list')
    expect(list).toHaveAttribute('aria-label', 'comments section')
  })
})
