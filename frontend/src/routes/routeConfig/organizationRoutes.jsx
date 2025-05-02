import {
  Organizations,
  AddEditOrg,
  OrganizationView
} from '@/views/Organizations'
import { AddEditUser } from '@/views/Users'
import ROUTES from '../routes'
import ViewUser from '@/views/Admin/AdminMenu/components/ViewUser'

export const organizationRoutes = [
  // IDIR routes
  {
    path: ROUTES.ORGANIZATIONS.LIST,
    element: <Organizations />,
    handle: { title: 'Organizations', crumb: () => 'Organizations' }
  },
  {
    path: ROUTES.ORGANIZATIONS.ADD,
    element: <AddEditOrg />,
    handle: { title: 'Add organization' }
  },
  {
    path: ROUTES.ORGANIZATIONS.VIEW,
    element: <OrganizationView />,
    handle: { title: 'View organization' }
  },
  {
    path: ROUTES.ORGANIZATIONS.EDIT,
    element: <AddEditOrg />,
    handle: { title: 'Edit organization' }
  },
  {
    path: ROUTES.ORGANIZATIONS.ADD_USER,
    element: <AddEditUser userType="bceid" />,
    handle: { title: 'New user' }
  },
  {
    path: ROUTES.ORGANIZATIONS.VIEW_USER,
    element: <ViewUser userType="bceid" />,
    handle: {
      crumb: () => 'Users',
      title: 'View user'
    }
  },
  {
    path: ROUTES.ORGANIZATIONS.EDIT_USER,
    element: <AddEditUser userType="bceid" />,
    handle: {
      crumb: () => 'Users',
      title: 'Edit user'
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
    element: <AddEditUser />,
    handle: { title: 'New user' }
  },
  {
    path: ROUTES.ORGANIZATION.VIEW_USER,
    element: <ViewUser />,
    handle: { title: 'View user' }
  },
  {
    path: ROUTES.ORGANIZATION.EDIT_USER,
    element: <AddEditUser />,
    handle: { title: 'Edit user' }
  }
]
