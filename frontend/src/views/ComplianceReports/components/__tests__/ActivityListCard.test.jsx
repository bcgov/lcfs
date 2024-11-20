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
        'report:activityLinksList': 'Activity Links List',
        'report:uploadLabel': 'Upload Documents',
        'report:supportingDocs': 'Supporting Documents'
      }
      return translations[key]
    }
  })
}))

// Mock the ActivityLinksList component
vi.mock('./ActivityLinkList', () => ({
  ActivityLinksList: () => <div>Mocked Activity Links List</div>
}))

// Mock the DocumentUploadDialog component
vi.mock('@/components/Documents/DocumentUploadDialog', () => ({
  __esModule: true,
  default: ({ open }) =>
    open ? <div>Mocked Document Upload Dialog</div> : null
}))

describe('ActivityListCard', () => {
  const defaultProps = {
    name: 'Test Name',
    period: 'Q1 2023',
    reportId: '12345'
  }

  it('renders correctly with given props', () => {
    render(<ActivityListCard {...defaultProps} />, { wrapper })

    expect(screen.getByText('Report Activities')).toBeInTheDocument()
    expect(
      screen.getByText('Activity Header for Test Name during Q1 2023')
    ).toBeInTheDocument()
    expect(screen.getByText('Activity Links List:')).toBeInTheDocument()
    expect(screen.getByText('Upload Documents')).toBeInTheDocument()
    expect(screen.getByText('Supporting Documents')).toBeInTheDocument()
  })

  it('opens the DocumentUploadDialog when the button is clicked', () => {
    render(<ActivityListCard {...defaultProps} />, { wrapper })

    const button = screen.getByRole('button', { name: /supporting documents/i })
    fireEvent.click(button)

    expect(
      screen.getByText('Mocked Document Upload Dialog')
    ).toBeInTheDocument()
  })
})
