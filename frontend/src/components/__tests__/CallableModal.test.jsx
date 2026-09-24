import { test } from '@/tests/utils/fixtures'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRef } from 'react'
import { BCAlert } from '@/components/BCAlert/BCAlert'
import { FloatingAlert } from '@/components/BCAlert/FloatingAlert'
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
    <span
      data-test="icon-close"
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
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
  test('renders info alert with the info icon by default', ({
    render,
    theme
  }) => {
    render(<BCAlert severity="info">Info message</BCAlert>, [theme])
    expect(screen.getByText('Info message')).toBeInTheDocument()
    expect(screen.getByTestId('icon-info')).toBeInTheDocument()
  })

  test('renders error alert with error icon', ({ render, theme }) => {
    render(<BCAlert severity="error">Error message</BCAlert>, [theme])
    expect(screen.getByTestId('icon-error')).toBeInTheDocument()
    expect(screen.getByText('Error message')).toBeInTheDocument()
  })

  test('renders warning alert with warning icon', ({ render, theme }) => {
    render(<BCAlert severity="warning">Warning message</BCAlert>, [theme])
    expect(screen.getByTestId('icon-warning')).toBeInTheDocument()
  })

  test('renders success alert with check-circle icon', ({ render, theme }) => {
    render(<BCAlert severity="success">Success</BCAlert>, [theme])
    expect(screen.getByTestId('icon-success')).toBeInTheDocument()
  })

  test('renders pending alert with a circular progress spinner', ({
    render,
    theme
  }) => {
    render(<BCAlert severity="pending">Loading…</BCAlert>, [theme])
    expect(screen.getByTestId('circular-progress')).toBeInTheDocument()
  })
})

describe('BCAlert — dismissible', () => {
  test('does not render a close icon when dismissible is false (default)', ({
    render,
    theme
  }) => {
    render(<BCAlert severity="info">Hello</BCAlert>, [theme])
    expect(screen.queryByTestId('icon-close')).not.toBeInTheDocument()
  })

  test('renders a close icon when dismissible is true', ({ render, theme }) => {
    render(
      <BCAlert severity="info" dismissible>
        Dismissible
      </BCAlert>,
      [theme]
    )
    expect(screen.getByTestId('icon-close')).toBeInTheDocument()
  })

  test('hides the alert after clicking the close icon', ({ render, theme }) => {
    render(
      <BCAlert severity="info" dismissible>
        Click to dismiss
      </BCAlert>,
      [theme]
    )
    fireEvent.click(screen.getByTestId('icon-close'))
    // After the close click the fade transitions to unmount state
    // The Fade mock hides the content when `in` is false
    expect(screen.queryByText('Click to dismiss')).not.toBeInTheDocument()
  })
})

describe('BCAlert — imperative triggerAlert ref', () => {
  test('exposes a triggerAlert method via ref', ({ render, theme }) => {
    const alertRef = createRef()
    render(
      <BCAlert ref={alertRef} severity="info" noFade>
        Triggered alert
      </BCAlert>,
      [theme]
    )
    expect(typeof alertRef.current?.triggerAlert).toBe('function')
  })

  test('re-shows the alert when triggerAlert is called', ({
    render,
    theme
  }) => {
    const alertRef = createRef()
    render(
      <BCAlert ref={alertRef} severity="info" noFade>
        Re-triggered
      </BCAlert>,
      [theme]
    )
    act(() => {
      alertRef.current.triggerAlert()
    })
    expect(screen.getByText('Re-triggered')).toBeInTheDocument()
  })
})

describe('FloatingAlert — imperative triggerAlert ref', () => {
  test('renders nothing initially (no severity set)', ({ render, theme }) => {
    const { container } = render(<FloatingAlert />, [theme])
    // Without an initial severity the component returns null
    expect(container.firstChild).toBeNull()
  })

  test('shows a message after triggerAlert is called via ref', ({
    render,
    theme
  }) => {
    const alertRef = createRef()
    render(<FloatingAlert ref={alertRef} delay={30000} />, [theme])

    act(() => {
      alertRef.current.triggerAlert({ severity: 'success', message: 'Saved!' })
    })

    expect(screen.getByText('Saved!')).toBeInTheDocument()
  })

  test('shows different severity icons after triggerAlert', ({
    render,
    theme
  }) => {
    const alertRef = createRef()
    render(<FloatingAlert ref={alertRef} delay={30000} />, [theme])

    act(() => {
      alertRef.current.triggerAlert({ severity: 'error', message: 'Failed!' })
    })
    expect(screen.getByTestId('icon-error')).toBeInTheDocument()
    expect(screen.getByText('Failed!')).toBeInTheDocument()
  })

  test('renders a close icon when dismissible (default)', ({
    render,
    theme
  }) => {
    const alertRef = createRef()
    render(<FloatingAlert ref={alertRef} delay={30000} />, [theme])
    act(() => {
      alertRef.current.triggerAlert({ severity: 'info', message: 'Notice' })
    })
    expect(screen.getByTestId('icon-close')).toBeInTheDocument()
  })

  test('hides the alert when the close icon is clicked', ({
    render,
    theme
  }) => {
    const alertRef = createRef()
    render(<FloatingAlert ref={alertRef} delay={30000} />, [theme])
    act(() => {
      alertRef.current.triggerAlert({
        severity: 'warning',
        message: 'Watch out'
      })
    })
    fireEvent.click(screen.getByTestId('icon-close'))
    expect(screen.queryByText('Watch out')).not.toBeInTheDocument()
  })
})
