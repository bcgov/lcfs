import { test } from '@/tests/utils/fixtures'
import 'react';
import { describe, expect, vi } from 'vitest';
import '@testing-library/react';
import BCUserInitials from '../BCUserInitials'

describe('BCUserInitials tooltip sanitisation', () => {
  test('does not execute markup embedded in untrusted comment text', ({
    render,
    app
  }) => {
    const onError = vi.fn()
    window.__xss__ = onError

    render(
      <BCUserInitials
        fullName="Kenneth Chan"
        tooltipText={'<img src=x onerror="window.__xss__()">hello'}
      />,
      [...app]
    )

    expect(onError).not.toHaveBeenCalled()
    delete window.__xss__
  })

  test('renders no markup from an HTML comment body', ({ render, app }) => {
    const { container } = render(
      <BCUserInitials
        fullName="Kenneth Chan"
        tooltipText="<p>plain text</p>"
      />,
      [...app]
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('p')).toBeNull()
  })
})
