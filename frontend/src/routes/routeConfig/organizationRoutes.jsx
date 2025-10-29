import {
  Organizations,
  AddEditOrg,
  OrganizationView
} from '@/views/Organizations'
import { AddEditUser } from '@/views/Users'
import ROUTES from '../routes'
import UserDetailsCard from '@/views/Admin/AdminMenu/components/UserDetailsCard'
import i18n from '@/i18n'
import PenaltyLogManage from '@/views/Organizations/OrganizationView/components/PenaltyLog/PenaltyLogManage'
import { OrganizationDetailsCard } from '@/views/Organizations/OrganizationView/OrganizationDetailsCard'
import ComplianceTracking from '@/views/Organizations/OrganizationView/components/ComplianceTracking'
import SupplyHistory from '@/views/Organizations/OrganizationView/components/SupplyHistory'
import { PenaltyLog } from '@/views/Organizations/OrganizationView/components/PenaltyLog/PenaltyLog'
import CompanyOverview from '@/views/Organizations/OrganizationView/components/CompanyOverview'
import { CreditLedger } from '@/views/Organizations/OrganizationView/CreditLedger'
import { OrganizationUsers } from '@/views/Organizations/OrganizationView/OrganizationUsers'

export const organizationRoutes = [
  // IDIR routes
  {
    path: ROUTES.ORGANIZATIONS.LIST,
    element: <Organizations />,
    handle: { title: 'Organizations', crumb: () => 'Organizations' }
  },
  {
    path: ROUTES.ORGANIZATIONS.ADD,
    element: <OrganizationView addMode={true} />,
    handle: { title: 'Add organization' }
  },
  {
    path: ROUTES.ORGANIZATIONS.VIEW, // Organization profile view or edit
    element: <OrganizationView />,
    handle: { title: 'Organization profile' }
  },
  {
    path: ROUTES.ORGANIZATIONS.USERS,
    element: <OrganizationView />,
    handle: { title: 'Organization users' }
  },
  {
    path: ROUTES.ORGANIZATIONS.CREDIT_LEDGER,
    element: <OrganizationView />,
    handle: { title: 'Credit ledger' }
  },
  {
    path: ROUTES.ORGANIZATIONS.COMPANY_OVERVIEW,
    element: <OrganizationView />,
    handle: { title: 'Company overview' }
  },
  {
    path: ROUTES.ORGANIZATIONS.PENALTY_LOG,
    element: <OrganizationView />,
    handle: { title: 'Penalty log', crumb: () => 'Penalty log' }
  },
  {
    path: ROUTES.ORGANIZATIONS.PENALTY_LOG_MANAGE,
    element: <OrganizationView />,
    handle: { title: 'Manage penalty log', crumb: () => 'Penalty log' }
  },
  {
    path: ROUTES.ORGANIZATIONS.SUPPLY_HISTORY,
    element: <OrganizationView />,
    handle: { title: 'Supply history' }
  },
  {
    path: ROUTES.ORGANIZATIONS.COMPLIANCE_TRACKING,
    element: <OrganizationView />,
    handle: { title: 'Compliance tracking' }
  },
  {
    path: ROUTES.ORGANIZATIONS.ADD_USER,
    element: <UserDetailsCard addMode={true} userType="bceid" />,
    handle: { title: 'New user' }
  },
  {
    path: ROUTES.ORGANIZATIONS.VIEW_USER,
    element: <UserDetailsCard userType="bceid" />,
    handle: {
      crumb: () => 'Users',
      title: 'User profile'
    }
  },
  // BCeID Routes
  {
    path: ROUTES.ORGANIZATION.ORG,
    element: <OrganizationView />,
    handle: { title: 'Organization' }
  },
  {
    path: ROUTES.ORGANIZATION.USERS,
    element: <OrganizationView />,
    handle: { title: 'Users' }
  },
  {
    path: ROUTES.ORGANIZATION.ADD_USER,
    element: <UserDetailsCard addMode={true} userType="bceid" />,
    handle: { title: 'New user' }
  },
  {
    path: ROUTES.ORGANIZATION.VIEW_USER,
    element: <UserDetailsCard userType="bceid" />,
    handle: { title: 'User profile' }
  },
  {
    path: ROUTES.ORGANIZATION.CREDIT_LEDGER,
    element: <OrganizationView />,
    handle: { title: 'Credit ledger' }
  }
]

export const orgDashboardRoutes = (orgID, isGovernment) => {
  const idirBasePath = ROUTES.ORGANIZATIONS.VIEW.replace(':orgID', orgID || '')
  const bceidBasePath = ROUTES.ORGANIZATION.ORG

  const bceidTabs = [
    {
      path: bceidBasePath,
      match: (pathname) =>
        pathname === bceidBasePath || pathname === `${bceidBasePath}/`,
      label: i18n.t('org:tabs.dashboard')
    },
    {
      path: ROUTES.ORGANIZATION.USERS,
      match: (pathname) => pathname.startsWith(ROUTES.ORGANIZATION.USERS),
      label: i18n.t('org:tabs.users')
    },
    {
      path: ROUTES.ORGANIZATION.CREDIT_LEDGER,
      match: (pathname) =>
        pathname.startsWith(ROUTES.ORGANIZATION.CREDIT_LEDGER),
      label: i18n.t('org:tabs.creditLedger')
    }
  ]

  const idirTabs = [
    {
      path: idirBasePath,
      match: (pathname) =>
        pathname === idirBasePath || pathname === `${idirBasePath}/`,
      label: i18n.t('org:tabs.dashboard')
    },
    {
      path: ROUTES.ORGANIZATIONS.USERS.replace(':orgID', orgID || ''),
      match: (pathname) => pathname.includes('/users'),
      label: i18n.t('org:tabs.users')
    },
    {
      path: ROUTES.ORGANIZATIONS.CREDIT_LEDGER.replace(':orgID', orgID || ''),
      match: (pathname) => pathname.includes('/credit-ledger'),
      label: i18n.t('org:tabs.creditLedger')
    },
    {
      path: ROUTES.ORGANIZATIONS.COMPANY_OVERVIEW.replace(
        ':orgID',
        orgID || ''
      ),
      match: (pathname) => pathname.includes('/company-overview'),
      label: i18n.t('org:tabs.companyOverview')
    },
    {
      path: ROUTES.ORGANIZATIONS.PENALTY_LOG.replace(':orgID', orgID || ''),
      match: (pathname) =>
        pathname.includes('/penalty-log') && !pathname.includes('/manage'),
      label: i18n.t('org:tabs.penaltyLog')
    },
    {
      path: ROUTES.ORGANIZATIONS.SUPPLY_HISTORY.replace(':orgID', orgID || ''),
      match: (pathname) => pathname.includes('/supply-history'),
      label: i18n.t('org:tabs.supplyHistory')
    },
    {
      path: ROUTES.ORGANIZATIONS.COMPLIANCE_TRACKING.replace(
        ':orgID',
        orgID || ''
      ),
      match: (pathname) => pathname.includes('/compliance-tracking'),
      label: i18n.t('org:tabs.complianceTracking')
    }
  ]

  if (!isGovernment) {
    return bceidTabs
  }
  return idirTabs
}

export const orgDashboardRenderers = (
  isGovernment,
  currentPath,
  orgID,
  addMode,
  navigate
) => {
  if (!isGovernment) {
    const bceidBasePath = ROUTES.ORGANIZATION.ORG
    if (currentPath.startsWith(ROUTES.ORGANIZATION.USERS)) {
      return <OrganizationUsers />
    }
    if (currentPath.startsWith(ROUTES.ORGANIZATION.CREDIT_LEDGER)) {
      return <CreditLedger organizationId={orgID} />
    }
    if (currentPath !== bceidBasePath && currentPath !== `${bceidBasePath}/`) {
      navigate(bceidBasePath, { replace: true })
      return <OrganizationDetailsCard addMode={addMode} />
    }
    return <OrganizationDetailsCard addMode={addMode} />
  }

  if (currentPath.includes('/penalty-log/manage')) {
    return <PenaltyLogManage />
  }

  if (currentPath.includes('/users')) {
    return <OrganizationUsers />
  }
  if (currentPath.includes('/credit-ledger')) {
    return <CreditLedger organizationId={orgID} />
  }
  if (currentPath.includes('/company-overview')) {
    return <CompanyOverview />
  }
  if (currentPath.includes('/penalty-log')) {
    return <PenaltyLog />
  }
  if (currentPath.includes('/supply-history')) {
    return <SupplyHistory organizationId={orgID} />
  }
  if (currentPath.includes('/compliance-tracking')) {
    return <ComplianceTracking />
  }

  // Default to dashboard
  return <OrganizationDetailsCard addMode={addMode} />
}
