import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { wrapper } from '@/tests/utils/wrapper'
import { initiativeAgreementColDefs } from '../_schema'

vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useInitiativeAgreementStatuses: () => ({ data: [], isLoading: false })
}))

const t = (key) => key

const lastCommentColumn = () =>
  initiativeAgreementColDefs(t).find((col) => col.field === 'lastComment')

describe('last comment column', () => {
  it('renders the commenter initials and the comment as a tooltip', () => {
    const Renderer = lastCommentColumn().cellRenderer
    render(
      <Renderer
        data={{
          lastComment: { fullName: 'Kenneth Chan', comment: 'plain words' }
        }}
      />,
      { wrapper }
    )
    expect(screen.getByText('KC')).toBeInTheDocument()
  })

  it('renders nothing when the agreement has no visible comment', () => {
    const Renderer = lastCommentColumn().cellRenderer
    const { container } = render(<Renderer data={{ lastComment: null }} />, {
      wrapper
    })
    expect(container.textContent).toBe('')
  })

  it('is not sortable or filterable', () => {
    const col = lastCommentColumn()
    expect(col.sortable).toBe(false)
    expect(col.filter).toBe(false)
  })
})
