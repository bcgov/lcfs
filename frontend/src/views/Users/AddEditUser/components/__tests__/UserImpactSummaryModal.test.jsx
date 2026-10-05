import { test } from '@/tests/utils/fixtures'
import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { describe, expect, vi, beforeEach } from 'vitest'
import { UserImpactSummaryModal } from '../UserImpactSummaryModal'
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
    analyst: new Set([
      'IDIR_ANALYST__GOVERNMENT_NOTIFICATION',
      'IDIR_ANALYST__TRANSFER__SUBMITTED_FOR_REVIEW'
    ]),
    compliance_manager: new Set([
      'IDIR_COMPLIANCE_MANAGER__GOVERNMENT_NOTIFICATION'
    ])
  },
  NOTIF_TYPE_CONFIG: {
    IDIR_ANALYST__GOVERNMENT_NOTIFICATION: [
      'idirAnalyst.categories.governmentNotifications',
      'subscription',
      0
    ],
    IDIR_ANALYST__TRANSFER__SUBMITTED_FOR_REVIEW: [
      'idirAnalyst.categories.transfers',
      'submittedForReview',
      1
    ]
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

const renderModal = (render, theme, props = {}, providers = []) =>
  render(<UserImpactSummaryModal {...baseProps} {...props} />, [
    theme,
    ...providers
  ])

// ── Tests ────────────────────────────────────────────────────────────────────

describe('UserImpactSummaryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders nothing when open is false', ({ render, theme }) => {
    const { container } = renderModal(render, theme, { open: false })
    expect(container).toBeEmptyDOMElement()
  })

  test('shows the user full name in the identity card', ({ render, theme }) => {
    renderModal(render, theme)
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  test('calls onClose when the close button is clicked', ({
    render,
    theme
  }) => {
    const onClose = vi.fn()
    renderModal(render, theme, { onClose })
    fireEvent.click(screen.getByTestId('impact-modal-close-btn'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  test('calls onConfirm when the confirm button is clicked', ({
    render,
    theme
  }) => {
    const onConfirm = vi.fn()
    renderModal(render, theme, { onConfirm })
    fireEvent.click(screen.getByTestId('impact-modal-confirm-btn'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  test('shows profile-only notice when no role or status changes', ({
    render,
    theme
  }) => {
    renderModal(render, theme)
    expect(
      screen.getByText(
        'No role or status changes. Only profile information will be updated.'
      )
    ).toBeInTheDocument()
  })

  test('shows roles being added when new roles are introduced', ({
    render,
    theme
  }) => {
    renderModal(render, theme, {
      currentUserData: {
        ...baseProps.currentUserData,
        roles: [{ name: 'Government' }]
      },
      proposedRoles: ['government', 'analyst']
    })
    expect(screen.getByText('Role changes')).toBeInTheDocument()
    expect(screen.getByText('Roles being added')).toBeInTheDocument()
  })

  test('shows roles being removed when roles are taken away', ({
    render,
    theme
  }) => {
    renderModal(render, theme, {
      currentUserData: {
        ...baseProps.currentUserData,
        roles: [{ name: 'Government' }, { name: 'Analyst' }]
      },
      proposedRoles: ['government']
    })
    expect(screen.getByText('Roles being removed')).toBeInTheDocument()
  })

  test('shows account status section when status changes', ({
    render,
    theme
  }) => {
    renderModal(render, theme, {
      currentUserData: { ...baseProps.currentUserData, isActive: true },
      proposedIsActive: false
    })
    expect(screen.getByText('Account status')).toBeInTheDocument()
  })

  test('shows deactivation warning when account is being deactivated', ({
    render,
    theme
  }) => {
    renderModal(render, theme, {
      currentUserData: { ...baseProps.currentUserData, isActive: true },
      proposedIsActive: false
    })
    expect(screen.getByText(/Deactivating this account/i)).toBeInTheDocument()
  })

  test('does NOT show assigned work panel for BCeID (non-government) users', ({
    render,
    theme
  }) => {
    renderModal(render, theme, {
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

  test('shows assigned work panel when government user loses analyst role and has assigned items', async ({
    render,
    theme,
    router
  }) => {
    const { useUserAssignedWork } = await import('@/hooks/useUser')
    useUserAssignedWork.mockReturnValue({
      data: {
        complianceReports: [
          {
            complianceReportId: 1,
            organization: 'Acme',
            period: '2024',
            status: 'Submitted'
          }
        ],
        ciApplications: []
      },
      isFetching: false,
      isError: false
    })

    renderModal(
      render,
      theme,
      {
        currentUserData: {
          ...baseProps.currentUserData,
          roles: [{ name: 'Government' }, { name: 'Analyst' }]
        },
        proposedRoles: ['government']
      },
      [router]
    )

    expect(screen.getByText('Assigned work affected')).toBeInTheDocument()
    expect(screen.getByText('Compliance reports (1)')).toBeInTheDocument()
  })

  test('shows subscriptions that will be removed when role-linked subs exist', async ({
    render,
    theme,
    router
  }) => {
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

    renderModal(
      render,
      theme,
      {
        currentUserData: {
          ...baseProps.currentUserData,
          roles: [{ name: 'Government' }, { name: 'Analyst' }]
        },
        proposedRoles: ['government']
      },
      [router]
    )

    expect(
      screen.getByText('Subscriptions that will be removed')
    ).toBeInTheDocument()
  })

  test('does NOT call government APIs when isCurrentUserGovernment is false', async ({
    render,
    theme
  }) => {
    const { useTargetUserNotificationSubscriptions } = await import(
      '@/hooks/useNotifications'
    )
    const { useUserAssignedWork } = await import('@/hooks/useUser')

    renderModal(render, theme, { isCurrentUserGovernment: false })

    expect(useTargetUserNotificationSubscriptions).toHaveBeenCalledWith(null)
    expect(useUserAssignedWork).toHaveBeenCalledWith(null)
  })

  test('shows a loading spinner while impact data is loading', async ({
    render,
    theme
  }) => {
    const { useTargetUserNotificationSubscriptions } = await import(
      '@/hooks/useNotifications'
    )
    useTargetUserNotificationSubscriptions.mockReturnValue({
      data: [],
      isFetching: true
    })

    renderModal(render, theme)

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  test('uses title for new user', ({ render, theme }) => {
    renderModal(render, theme, { isNewUser: true, currentUserData: null })
    expect(screen.getByText('admin:impactModal.titleNew')).toBeInTheDocument()
  })

  test('uses title for existing user', ({ render, theme }) => {
    renderModal(render, theme, { isNewUser: false })
    expect(screen.getByText('admin:impactModal.titleEdit')).toBeInTheDocument()
  })

  test('confirm button has no arrow icon', ({ render, theme }) => {
    renderModal(render, theme)
    const confirmBtn = screen.getByTestId('impact-modal-confirm-btn')
    // ArrowForward renders an svg with data-testid="ArrowForwardIcon" in MUI
    expect(
      confirmBtn.querySelector('[data-testid="ArrowForwardIcon"]')
    ).toBeNull()
  })
})
