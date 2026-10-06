import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BCPagination } from '../BCPagination'

vi.mock('../BCPaginationActions', () => ({
  BCPaginationActions: () => <div />
}))

describe('BCPagination accessibility', () => {
  it('exposes pagination controls in a named navigation landmark', () => {
    render(
      <BCPagination
        total={13}
        page={1}
        handleChangePage={vi.fn()}
        size={10}
        handleChangeRowsPerPage={vi.fn()}
      />
    )

    expect(
      screen.getByRole('navigation', { name: 'pagination for BC DataGrid' })
    ).toBeInTheDocument()
  })

  it('includes the range summary in keyboard focus order', async () => {
    const user = userEvent.setup()
    render(
      <BCPagination
        total={13}
        page={1}
        handleChangePage={vi.fn()}
        size={10}
        handleChangeRowsPerPage={vi.fn()}
      />
    )

    await user.tab()
    expect(screen.getByRole('combobox', { name: 'Page Size:' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('status')).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('1 to 10 of 13')
  })

  it('exposes the result range as one atomic, polite announcement and updates it', () => {
    const props = {
      total: 13,
      page: 1,
      handleChangePage: vi.fn(),
      size: 10,
      handleChangeRowsPerPage: vi.fn()
    }
    const { rerender } = render(<BCPagination {...props} />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('1 to 10 of 13')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveAttribute('aria-atomic', 'true')

    rerender(<BCPagination {...props} page={2} />)

    expect(screen.getByRole('status')).toBe(status)
    expect(status).toHaveTextContent('11 to 13 of 13')

    rerender(<BCPagination {...props} page={1} size={5} />)
    expect(status).toHaveTextContent('1 to 5 of 13')

    rerender(<BCPagination {...props} total={1} />)
    expect(status).toHaveTextContent('1 to 1 of 1')

    rerender(<BCPagination {...props} total={0} />)
    expect(status).toHaveTextContent('0 to 0 of 0')
  })
})
