import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FSEProcessing } from '../FSEProcessing'
import { wrapper } from '@/tests/utils/wrapper.jsx'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/compliance-reporting/fse-processing/123' }),
  useParams: () => ({ siteId: '123' })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn()
}))

vi.mock('@/hooks/useFSEProcessing', () => ({
  useFSEProcessing: vi.fn()
}))

vi.mock('@/components/BCButton', () => ({
  __esModule: true,
  default: ({ children, onClick, startIcon, endIcon, ...props }) => (
    <button type="button" onClick={onClick} {...props}>
      {startIcon}
      {children}
      {endIcon}
    </button>
  )
}))

vi.mock('@/components/BCAlert', () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
  BCAlert2: React.forwardRef((props, ref) => <div data-testid="alert-box" />)
}))

vi.mock('@/components/Loading', () => ({
  __esModule: true,
  default: () => <div>Loading...</div>
}))

vi.mock('@/components/BCDataGrid/BCGridViewer.jsx', () => ({
  BCGridViewer: () => <div data-testid="bc-grid-viewer" />
}))

vi.mock('../components/BulkProcessingModals', () => ({
  BulkProcessingModals: () => <div data-testid="bulk-processing-modals" />
}))

import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useFSEProcessing } from '@/hooks/useFSEProcessing'

describe('FSEProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useFSEProcessing.mockImplementation((siteId) => {
      if (siteId) {
        return {
          data: {
            site: {
              site_name: 'Test Site',
              status: 'Submitted',
              version: 1,
              site_code: 'SITE-001',
              organization: 'Test Org',
              site_address: '123 Main St',
              city: 'Victoria',
              postal_code: 'V8V 1A1',
              intended_uses: []
            },
            equipment: {
              items: [
                {
                  charging_equipment_id: 1,
                  status: 'Submitted',
                  registration_number: 'REG-001'
                }
              ],
              total_count: 1
            }
          },
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn()
        }
      }

      return {
        validateEquipment: vi.fn(),
        returnToDraft: vi.fn(),
        isValidating: false,
        isReturningToDraft: false
      }
    })
  })

  it('hides return-to-draft action for BCeID users', () => {
    useCurrentUser.mockReturnValue({
      hasAnyRole: vi.fn(() => false)
    })

    render(<FSEProcessing />, { wrapper })

    expect(
      screen.queryByRole('button', { name: 'Return selected to draft' })
    ).not.toBeInTheDocument()
  })

  it('shows return-to-draft action for IDIR users', () => {
    useCurrentUser.mockReturnValue({
      hasAnyRole: vi.fn(() => true)
    })

    render(<FSEProcessing />, { wrapper })

    expect(
      screen.getByRole('button', { name: 'Return selected to draft' })
    ).toBeInTheDocument()
  })
})
