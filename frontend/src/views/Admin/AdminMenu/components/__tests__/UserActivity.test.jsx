import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { UserActivity } from '../UserActivity'
import { wrapper } from '@/tests/utils/wrapper'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock react-router-dom
const mockUseNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: () => mockUseNavigate
}))

// Mock constants
vi.mock('@/constants/routes', () => ({
  ROUTES: {
    TRANSFERS_VIEW: '/transfers/:transferId',
    ADMIN_ADJUSTMENT_VIEW: '/admin-adjustment/:transactionId',
    INITIATIVE_AGREEMENT_VIEW: '/initiative-agreement/:transactionId'
  }
}))

// Mock userActivityColDefs
vi.mock('@/views/Admin/AdminMenu/components/_schema', () => ({
  userActivityColDefs: () => [
    { headerName: 'Column 1', field: 'col1' },
    { headerName: 'Column 2', field: 'col2' }
  ]
}))

// Variable to hold the onRowClicked function
let onRowClickedMock

// Mock BCGridViewer
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: (props) => {
    onRowClickedMock = props.onRowClicked
    return <div data-test="bc-grid-viewer">BCGridViewer</div>
  }
}))

describe('UserActivity', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders the component', () => {
    render(<UserActivity />, { wrapper })
    expect(screen.getByText('admin:UserActivity')).toBeInTheDocument()
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('navigates to the correct route when transactionType is Transfer', () => {
    render(<UserActivity />, { wrapper })
    onRowClickedMock({
      data: { transactionType: 'Transfer', transactionId: '123' }
    })
    expect(mockUseNavigate).toHaveBeenCalledWith('/transfers/123')
  })

  it('navigates to the correct route when transactionType is AdminAdjustment', () => {
    render(<UserActivity />, { wrapper })
    onRowClickedMock({
      data: { transactionType: 'AdminAdjustment', transactionId: '456' }
    })
    expect(mockUseNavigate).toHaveBeenCalledWith('/admin-adjustment/456')
  })

  it('navigates to the correct route when transactionType is InitiativeAgreement', () => {
    render(<UserActivity />, { wrapper })
    onRowClickedMock({
      data: { transactionType: 'InitiativeAgreement', transactionId: '789' }
    })
    expect(mockUseNavigate).toHaveBeenCalledWith('/initiative-agreement/789')
  })
})
