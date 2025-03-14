import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { ActivityListCard } from '@/views/ComplianceReports/components/ActivityListCard'
import { wrapper } from '@/tests/utils/wrapper'

// Mock the useTranslation hook
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => {
      const translations = {
        'report:reportActivities': 'Report Activities',
        'report:activityHdrLabel': `Activity Header for ${options?.name} during ${options?.period}`,
        'report:activityLinksList': 'Activity Links List'
      }
      return translations[key]
    }
  })
}))

vi.mock('@/services/useApiService')

// Mock the ActivityLinksList component
vi.mock('./ActivityLinksList', () => ({
  ActivityLinksList: () => <div key="1">Mocked Activity Links List</div>
}))

describe('ActivityListCard', () => {
  const defaultProps = {
    name: 'Test Name',
    period: 'Q1 2023',
    reportID: '12345'
  }

  it('renders correctly with given props', () => {
    render(<ActivityListCard {...defaultProps} />, { wrapper })

    expect(screen.getByText('Report Activities')).toBeInTheDocument()
    expect(
      screen.getByText('Activity Header for Test Name during Q1 2023')
    ).toBeInTheDocument()
    expect(screen.getByText('Activity Links List:')).toBeInTheDocument()
  })
})
