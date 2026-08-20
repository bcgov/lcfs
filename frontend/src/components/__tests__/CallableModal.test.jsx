import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRef } from 'react'
import { BCAlert } from '@/components/BCAlert/BCAlert'
import { FloatingAlert } from '@/components/BCAlert/FloatingAlert'
import { wrapper } from '@/tests/utils/wrapper'

// BCAlert and FloatingAlert are the modern equivalent of the legacy
// CallableModal pattern: they expose an imperative `triggerAlert` handle
// via `useImperativeHandle` so callers can programmatically trigger them.

vi.mock('@/components/BCAlert/BCAlertRoot', () => ({
  __esModule: true,
  default: ({ children, ownerState, ...props }) => (
    <div data-test="bc-alert-root" data-severity={ownerState?.color} {...props}>
      {children}
    </div>
  )
}))

vi.mock('@mui/icons-material', () => ({
  Info: () => <span data-test="icon-info">ℹ</span>,
  Error: () => <span data-test="icon-error">✖</span>,
  Warning: () => <span data-test="icon-warning">⚠</span>,
  CheckCircle: () => <span data-test="icon-success">✔</span>,
  Close: ({ onClick }) => (
    <span data-test="icon-close" onClick={onClick} style={{ cursor: 'pointer' }}>
      ×
    </span>
  ),
  ExpandMore: ({ onClick }) => (
    <span data-test="icon-expand" onClick={onClick}>
      ▼
    </span>
  )
}))

vi.mock('@mui/material/Fade', () => ({
  __esModule: true,
  default: ({ children, in: show }) =>
    show ? <div data-test="fade-wrapper">{children}</div> : null
}))

vi.mock('@mui/material', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    CircularProgress: ({ size }) => (
      <span data-test="circular-progress" data-size={size}>
        ⟳
      </span>
    )
  }
})

describe('BCAlert — rendering severities', () => {
  it('renders info alert with the info icon by default', () => {
    render(<BCAlert severity="info">Info message</BCAlert>, { wrapper })
    expect(screen.getByText('Info message')).toBeInTheDocument()
    expect(screen.getByTestId('icon-info')).toBeInTheDocument()
  })

  it('renders error alert with error icon', () => {
    render(<BCAlert severity="error">Error message</BCAlert>, { wrapper })
    expect(screen.getByTestId('icon-error')).toBeInTheDocument()
    expect(screen.getByText('Error message')).toBeInTheDocument()
  })

  it('renders warning alert with warning icon', () => {
    render(<BCAlert severity="warning">Warning message</BCAlert>, { wrapper })
    expect(screen.getByTestId('icon-warning')).toBeInTheDocument()
  })

  it('renders success alert with check-circle icon', () => {
    render(<BCAlert severity="success">Success</BCAlert>, { wrapper })
    expect(screen.getByTestId('icon-success')).toBeInTheDocument()
  })

  it('renders pending alert with a circular progress spinner', () => {
    render(<BCAlert severity="pending">Loading…</BCAlert>, { wrapper })
    expect(screen.getByTestId('circular-progress')).toBeInTheDocument()
  })
})

describe('BCAlert — dismissible', () => {
  it('does not render a close icon when dismissible is false (default)', () => {
    render(<BCAlert severity="info">Hello</BCAlert>, { wrapper })
    expect(screen.queryByTestId('icon-close')).not.toBeInTheDocument()
  })

  it('renders a close icon when dismissible is true', () => {
    render(
      <BCAlert severity="info" dismissible>
        Dismissible
      </BCAlert>,
      { wrapper }
    )
    expect(screen.getByTestId('icon-close')).toBeInTheDocument()
  })

  it('hides the alert after clicking the close icon', () => {
    render(
      <BCAlert severity="info" dismissible>
        Click to dismiss
      </BCAlert>,
      { wrapper }
    )
    fireEvent.click(screen.getByTestId('icon-close'))
    // After the close click the fade transitions to unmount state
    // The Fade mock hides the content when `in` is false
    expect(screen.queryByText('Click to dismiss')).not.toBeInTheDocument()
  })
})

describe('BCAlert — imperative triggerAlert ref', () => {
  it('exposes a triggerAlert method via ref', () => {
    const alertRef = createRef()
    render(
      <BCAlert ref={alertRef} severity="info" noFade>
        Triggered alert
      </BCAlert>,
      { wrapper }
    )
    expect(typeof alertRef.current?.triggerAlert).toBe('function')
  })

  it('re-shows the alert when triggerAlert is called', () => {
    const alertRef = createRef()
    render(
      <BCAlert ref={alertRef} severity="info" noFade>
        Re-triggered
      </BCAlert>,
      { wrapper }
    )
    act(() => {
      alertRef.current.triggerAlert()
    })
    expect(screen.getByText('Re-triggered')).toBeInTheDocument()
  })
})

describe('FloatingAlert — imperative triggerAlert ref', () => {
  it('renders nothing initially (no severity set)', () => {
    const { container } = render(<FloatingAlert />, { wrapper })
    // Without an initial severity the component returns null
    expect(container.firstChild).toBeNull()
  })

  it('shows a message after triggerAlert is called via ref', () => {
    const alertRef = createRef()
    render(<FloatingAlert ref={alertRef} delay={30000} />, { wrapper })

    act(() => {
      alertRef.current.triggerAlert({ severity: 'success', message: 'Saved!' })
    })

    expect(screen.getByText('Saved!')).toBeInTheDocument()
  })

  it('shows different severity icons after triggerAlert', () => {
    const alertRef = createRef()
    render(<FloatingAlert ref={alertRef} delay={30000} />, { wrapper })

    act(() => {
      alertRef.current.triggerAlert({ severity: 'error', message: 'Failed!' })
    })
    expect(screen.getByTestId('icon-error')).toBeInTheDocument()
    expect(screen.getByText('Failed!')).toBeInTheDocument()
  })

  it('renders a close icon when dismissible (default)', () => {
    const alertRef = createRef()
    render(<FloatingAlert ref={alertRef} delay={30000} />, { wrapper })
    act(() => {
      alertRef.current.triggerAlert({ severity: 'info', message: 'Notice' })
    })
    expect(screen.getByTestId('icon-close')).toBeInTheDocument()
  })

  it('hides the alert when the close icon is clicked', () => {
    const alertRef = createRef()
    render(<FloatingAlert ref={alertRef} delay={30000} />, { wrapper })
    act(() => {
      alertRef.current.triggerAlert({ severity: 'warning', message: 'Watch out' })
    })
    fireEvent.click(screen.getByTestId('icon-close'))
    expect(screen.queryByText('Watch out')).not.toBeInTheDocument()
  })
})
