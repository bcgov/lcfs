import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserImpactSummaryModal } from '../UserImpactSummaryModal'
import { wrapper } from '@/tests/utils/wrapper'

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/hooks/useNotifications', () => ({
  useTargetUserNotificationSubscriptions: vi.fn(() => ({
    data: [],
    isFetching: false
  }))
}))

vi.mock('@/hooks/useUser', () => ({
  useUserAssignedWork: vi.fn(() => ({
    data: null,
    isFetching: false,
    isError: false
  }))
}))

vi.mock('@/constants/notificationCategories', () => ({
  ROLE_NOTIF_TYPES: {
    analyst: new Set(['IDIR_ANALYST__GOVERNMENT_NOTIFICATION', 'IDIR_ANALYST__TRANSFER__SUBMITTED_FOR_REVIEW']),
    compliance_manager: new Set(['IDIR_COMPLIANCE_MANAGER__GOVERNMENT_NOTIFICATION'])
  },
  NOTIF_TYPE_CONFIG: {
    IDIR_ANALYST__GOVERNMENT_NOTIFICATION: ['idirAnalyst.categories.governmentNotifications', 'subscription', 0],
    IDIR_ANALYST__TRANSFER__SUBMITTED_FOR_REVIEW: ['idirAnalyst.categories.transfers', 'submittedForReview', 1]
  },
  ROLE_ACCESS: {
    analyst: 'Make recommendations on transfers and compliance reports'
  }
}))

vi.mock('@/constants/roles', () => ({
  roles: {
    government: 'Government',
    supplier: 'Supplier',
    analyst: 'Analyst',
    compliance_manager: 'Compliance Manager',
    director: 'Director',
    signing_authority: 'Signing Authority',
    transfers: 'Transfers',
    compliance_reporting: 'Compliance Reporting',
    ci_applicant: 'CI Applicant',
    ia_proponent: 'IA Proponent',
    ia_signer: 'IA Signer',
    administrator: 'Administrator',
    system_admin: 'System Admin',
    manage_users: 'Manage Users',
    read_only: 'Read Only',
    ia_analyst: 'IA Analyst',
    ia_manager: 'IA Manager'
  }
}))

// ── Helpers ─────────────────────────────────────────────────────────────────

const baseProps = {
  open: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  currentUserData: {
    firstName: 'Jane',
    lastName: 'Smith',
    isActive: true,
    isGovernmentUser: true,
    roles: [{ name: 'Government' }, { name: 'Analyst' }]
  },
  proposedRoles: ['government', 'analyst'],
  proposedIsActive: true,
  isNewUser: false,
  userId: 42,
  isCurrentUserGovernment: true
}

const renderModal = (props = {}) =>
  render(<UserImpactSummaryModal {...baseProps} {...props} />, { wrapper })

// ── Tests ────────────────────────────────────────────────────────────────────

describe('UserImpactSummaryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when open is false', () => {
    const { container } = renderModal({ open: false })
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the user full name in the identity card', () => {
    renderModal()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.click(screen.getByTestId('impact-modal-close-btn'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn()
    renderModal({ onConfirm })
    fireEvent.click(screen.getByTestId('impact-modal-confirm-btn'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('shows profile-only notice when no role or status changes', () => {
    renderModal()
    expect(
      screen.getByText('No role or status changes. Only profile information will be updated.')
    ).toBeInTheDocument()
  })

  it('shows roles being added when new roles are introduced', () => {
    renderModal({
      currentUserData: {
        ...baseProps.currentUserData,
        roles: [{ name: 'Government' }]
      },
      proposedRoles: ['government', 'analyst']
    })
    expect(screen.getByText('Role changes')).toBeInTheDocument()
    expect(screen.getByText('Roles being added')).toBeInTheDocument()
  })

  it('shows roles being removed when roles are taken away', () => {
    renderModal({
      currentUserData: {
        ...baseProps.currentUserData,
        roles: [{ name: 'Government' }, { name: 'Analyst' }]
      },
      proposedRoles: ['government']
    })
    expect(screen.getByText('Roles being removed')).toBeInTheDocument()
  })

  it('shows account status section when status changes', () => {
    renderModal({
      currentUserData: { ...baseProps.currentUserData, isActive: true },
      proposedIsActive: false
    })
    expect(screen.getByText('Account status')).toBeInTheDocument()
  })

  it('shows deactivation warning when account is being deactivated', () => {
    renderModal({
      currentUserData: { ...baseProps.currentUserData, isActive: true },
      proposedIsActive: false
    })
    expect(screen.getByText(/Deactivating this account/i)).toBeInTheDocument()
  })

  it('does NOT show assigned work panel for BCeID (non-government) users', () => {
    renderModal({
      isCurrentUserGovernment: false,
      currentUserData: {
        ...baseProps.currentUserData,
        isGovernmentUser: false,
        roles: [{ name: 'Supplier' }, { name: 'Analyst' }]
      },
      proposedRoles: ['supplier']
    })
    expect(screen.queryByText('Assigned work affected')).not.toBeInTheDocument()
  })

  it('shows assigned work panel when government user loses analyst role and has assigned items', async () => {
    const { useUserAssignedWork } = await import('@/hooks/useUser')
    useUserAssignedWork.mockReturnValue({
      data: {
        complianceReports: [
          { complianceReportId: 1, organization: 'Acme', period: '2024', status: 'Submitted' }
        ],
        ciApplications: []
      },
      isFetching: false,
      isError: false
    })

    renderModal({
      currentUserData: {
        ...baseProps.currentUserData,
        roles: [{ name: 'Government' }, { name: 'Analyst' }]
      },
      proposedRoles: ['government']
    })

    expect(screen.getByText('Assigned work affected')).toBeInTheDocument()
    expect(screen.getByText('Compliance reports (1)')).toBeInTheDocument()
  })

  it('shows subscriptions that will be removed when role-linked subs exist', async () => {
    const { useTargetUserNotificationSubscriptions } = await import(
      '@/hooks/useNotifications'
    )
    useTargetUserNotificationSubscriptions.mockReturnValue({
      data: [
        {
          isEnabled: true,
          notificationTypeName: 'IDIR_ANALYST__TRANSFER__SUBMITTED_FOR_REVIEW',
          notificationChannelName: 'EMAIL'
        }
      ],
      isFetching: false
    })

    renderModal({
      currentUserData: {
        ...baseProps.currentUserData,
        roles: [{ name: 'Government' }, { name: 'Analyst' }]
      },
      proposedRoles: ['government']
    })

    expect(screen.getByText('Subscriptions that will be removed')).toBeInTheDocument()
  })

  it('does NOT call government APIs when isCurrentUserGovernment is false', async () => {
    const { useTargetUserNotificationSubscriptions } = await import(
      '@/hooks/useNotifications'
    )
    const { useUserAssignedWork } = await import('@/hooks/useUser')

    renderModal({ isCurrentUserGovernment: false })

    expect(useTargetUserNotificationSubscriptions).toHaveBeenCalledWith(null)
    expect(useUserAssignedWork).toHaveBeenCalledWith(null)
  })

  it('shows a loading spinner while impact data is loading', async () => {
    const { useTargetUserNotificationSubscriptions } = await import(
      '@/hooks/useNotifications'
    )
    useTargetUserNotificationSubscriptions.mockReturnValue({
      data: [],
      isFetching: true
    })

    renderModal()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('uses title for new user', () => {
    renderModal({ isNewUser: true, currentUserData: null })
    expect(screen.getByText('admin:impactModal.titleNew')).toBeInTheDocument()
  })

  it('uses title for existing user', () => {
    renderModal({ isNewUser: false })
    expect(screen.getByText('admin:impactModal.titleEdit')).toBeInTheDocument()
  })

  it('confirm button has no arrow icon', () => {
    renderModal()
    const confirmBtn = screen.getByTestId('impact-modal-confirm-btn')
    // ArrowForward renders an svg with data-testid="ArrowForwardIcon" in MUI
    expect(confirmBtn.querySelector('[data-testid="ArrowForwardIcon"]')).toBeNull()
  })
})
