import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { ActivityListCard } from '@/views/ComplianceReports/components/ActivityListCard'
import { wrapper } from '@/tests/utils/wrapper'

// Mock the useTranslation hook
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => {
      if (key === 'report:reportActivities') {
        return 'Report activities'
      }
      return key
    }
  })
}))

vi.mock('@/services/useApiService')

// Mock the ActivityLinksList component
vi.mock('@/views/ComplianceReports/components/ActivityLinksList', () => ({
  ActivityLinksList: () => <div>Mocked ActivityLinksList</div>
}))

describe('ActivityListCard', () => {
  const defaultProps = {
    name: 'Test Org',
    period: '2025',
    currentStatus: 'Draft'
  }

  it('renders correctly with given props', () => {
    render(<ActivityListCard {...defaultProps} />, { wrapper })

    expect(screen.getByText('Report activities')).toBeInTheDocument()
    expect(screen.getByText('Mocked ActivityLinksList')).toBeInTheDocument()
    expect(screen.queryByText(/Activity Header for/i)).not.toBeInTheDocument()
  })
})
