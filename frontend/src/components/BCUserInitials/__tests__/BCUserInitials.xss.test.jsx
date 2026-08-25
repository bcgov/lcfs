import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { wrapper } from '@/tests/utils/wrapper'
import BCUserInitials from '../BCUserInitials'

describe('BCUserInitials tooltip sanitisation', () => {
  it('does not execute markup embedded in untrusted comment text', () => {
    const onError = vi.fn()
    window.__xss__ = onError

    render(
      <BCUserInitials
        fullName="Kenneth Chan"
        tooltipText={'<img src=x onerror="window.__xss__()">hello'}
      />,
      { wrapper }
    )

    expect(onError).not.toHaveBeenCalled()
    delete window.__xss__
  })

  it('renders no markup from an HTML comment body', () => {
    const { container } = render(
      <BCUserInitials fullName="Kenneth Chan" tooltipText="<p>plain text</p>" />,
      { wrapper }
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('p')).toBeNull()
  })
})
