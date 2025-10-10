import {
  Organizations,
  AddEditOrg,
  OrganizationView
} from '@/views/Organizations'
import { AddEditUser } from '@/views/Users'
import ROUTES from '../routes'
import UserDetailsCard from '@/views/Admin/AdminMenu/components/UserDetailsCard'

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
    handle: { title: 'Penalty log' }
  },
  {
    path: ROUTES.ORGANIZATIONS.PENALTY_LOG_MANAGE,
    element: <OrganizationView />,
    handle: { title: 'Manage penalty log' }
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
    path: ROUTES.ORGANIZATION.ADD_USER,
    element: <UserDetailsCard addMode={true} userType="bceid" />,
    handle: { title: 'New user' }
  },
  {
    path: ROUTES.ORGANIZATION.VIEW_USER,
    element: <UserDetailsCard userType="bceid" />,
    handle: { title: 'User profile' }
  }
]
