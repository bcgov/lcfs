import 'react'
import { describe, expect, vi } from 'vite-plus/test'
import { screen } from '@testing-library/react'
import { PackageLockNotice } from '../PackageLockNotice'
import { test } from '@/tests/utils/fixtures'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => (options?.status ? `${key} (${options.status})` : key)
  })
}))

describe('PackageLockNotice', () => {
  test('names the status and says what is read-only', ({ render, app }) => {
    render(<PackageLockNotice status="Underway" />, app)

    const notice = screen.getByTestId('package-lock-notice')
    expect(notice).toHaveTextContent(
      'initiativeAgreement:detail.packageLockedTitle (Underway)'
    )
    expect(notice).toHaveTextContent(
      'initiativeAgreement:detail.packageLockedBody'
    )
    expect(
      screen.queryByTestId('package-lock-notice-action')
    ).not.toBeInTheDocument()
  })

  test('carries the change order action it is given (#5555)', ({
    render,
    app
  }) => {
    render(
      <PackageLockNotice
        status="Underway"
        action={<button type="button">Start change order</button>}
      />,
      app
    )

    expect(screen.getByTestId('package-lock-notice-action')).toContainElement(
      screen.getByRole('button', { name: 'Start change order' })
    )
  })
})
