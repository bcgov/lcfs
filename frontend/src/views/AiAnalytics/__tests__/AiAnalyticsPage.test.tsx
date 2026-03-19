import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

import { AiAnalyticsPage } from '../AiAnalyticsPage'
import { useCurrentUser } from '@/hooks/useCurrentUser'

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn()
}))

vi.mock('@/features/ai-analytics/AiAnalyticsPanel', () => ({
  AiAnalyticsPanel: () => <div data-test="ai-analytics-panel">panel</div>
}))

describe('AiAnalyticsPage', () => {
  it('renders a warning for non-government users', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      hasAnyRole: () => false
    } as never)

    render(<AiAnalyticsPage />)

    expect(
      screen.getByText(/currently available only to government users/i)
    ).toBeInTheDocument()
  })

  it('renders the panel for government users', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      hasAnyRole: () => true
    } as never)

    render(<AiAnalyticsPage />)

    expect(screen.getByTestId('ai-analytics-panel')).toBeInTheDocument()
  })
})
