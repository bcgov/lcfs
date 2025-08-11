import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
vi.mock('@/components/BCButton', () => ({
  default: ({ children, ...rest }) => <button {...rest}>{children}</button>
}))

import {
  GeofencingStatus,
  OverlapSummary,
  LoadingState,
  ErrorState,
  NoDataState
} from '../StatusComponent'

// Minimal mock for MUI CircularProgress used inside the component
vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material')
  return { ...actual, CircularProgress: () => <span data-test="progress" /> }
})

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))

describe('StatusComponent pieces', () => {
  it('GeofencingStatus renders loading and error messages', () => {
    const { rerender } = render(<GeofencingStatus status="loading" />)
    expect(screen.getByText(/Geofencing in progress/i)).toBeInTheDocument()

    rerender(<GeofencingStatus status="error" />)
    expect(screen.getByText(/Geofencing error/i)).toBeInTheDocument()
  })

  it('OverlapSummary switches severity based on stats', () => {
    const warnStats = {
      total: 2,
      overlapping: 1,
      nonOverlapping: 1,
      bcOverlapping: 0,
      nonBcOverlapping: 1
    }
    const okStats = {
      total: 2,
      overlapping: 0,
      nonOverlapping: 2,
      bcOverlapping: 0,
      nonBcOverlapping: 0
    }

    const { rerender } = render(<OverlapSummary overlapStats={warnStats} />)
    expect(screen.getByText(/Period Overlaps Detected/i)).toBeInTheDocument()

    rerender(<OverlapSummary overlapStats={okStats} />)
    expect(screen.getByText(/No Period Overlaps/i)).toBeInTheDocument()
  })

  it('LoadingState renders spinner text', () => {
    const { container } = render(<LoadingState />)
    expect(container.textContent).toMatch(/Loading map data/i)
  })

  it('ErrorState and NoDataState buttons call callbacks', async () => {
    const refetch = vi.fn()
    const reset = vi.fn()
    render(
      <ErrorState
        error={{ message: 'boom' }}
        refetch={refetch}
        resetGeofencing={reset}
      />
    )
    await userEvent.click(
      screen.getByRole('button', { name: /Refresh Map Data/i })
    )
    expect(refetch).toHaveBeenCalled()
    expect(reset).toHaveBeenCalled()

    const refetch2 = vi.fn()
    const reset2 = vi.fn()
    render(<NoDataState refetch={refetch2} resetGeofencing={reset2} />)
    const buttons = screen.getAllByRole('button', { name: /Refresh Map Data/i })
    await userEvent.click(buttons[buttons.length - 1])
    expect(refetch2).toHaveBeenCalled()
    expect(reset2).toHaveBeenCalled()
  })
})
