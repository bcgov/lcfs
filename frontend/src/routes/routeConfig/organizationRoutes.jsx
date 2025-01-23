import React, { lazy, Suspense } from 'react'
import ROUTES from '../routes'

// Lazy-loaded components
const Organizations = lazy(() => import('@/views/Organizations/Organizations.jsx'))
const AddEditOrg = lazy(() => import('@/views/Organizations/AddEditOrg/AddEditOrg'))
const ViewOrganization = lazy(
  () => import('@/views/Organizations/ViewOrganization/ViewOrganization')
)
const AddEditUser = lazy(() => import('@/views/Users/AddEditUser/AddEditUser'))
const ViewUser = lazy(
  () => import('@/views/Admin/AdminMenu/components/ViewUser')
)

// Utility function to wrap components with Suspense
const withSuspense = (Component, props = {}) => (
  <Suspense fallback={<div>Loading...</div>}>
    <Component {...props} />
  </Suspense>
)

export const organizationRoutes = [
  // IDIR Routes
  {
    path: ROUTES.ORGANIZATIONS,
    element: withSuspense(Organizations),
    handle: { title: 'Organizations', crumb: () => 'Organizations' }
  },
  {
    path: ROUTES.ORGANIZATIONS.ADD,
    element: withSuspense(AddEditOrg),
    handle: { title: 'Add organization' }
  },
  {
    path: ROUTES.ORGANIZATIONS.VIEW,
    element: withSuspense(ViewOrganization),
    handle: { title: 'View organization' }
  },
  {
    path: ROUTES.ORGANIZATIONS.EDIT,
    element: withSuspense(AddEditOrg),
    handle: { title: 'Edit organization' }
  },
  {
    path: ROUTES.ORGANIZATIONS.ADD_USER,
    element: withSuspense(AddEditUser, { userType: 'bceid' }),
    handle: { title: 'New user' }
  },
  {
    path: ROUTES.ORGANIZATIONS.VIEW_USER,
    element: withSuspense(ViewUser, { userType: 'bceid' }),
    handle: {
      crumb: () => 'Users',
      title: 'View user'
    }
  },
  {
    path: ROUTES.ORGANIZATIONS.EDIT_USER,
    element: withSuspense(AddEditUser, { userType: 'bceid' }),
    handle: {
      crumb: () => 'Users',
      title: 'Edit user'
    }
  },
  // BCeID Routes
  {
    path: ROUTES.ORGANIZATION,
    element: withSuspense(ViewOrganization),
    handle: { title: 'Organization' }
  },
  {
    path: ROUTES.ORGANIZATION.ADD_USER,
    element: withSuspense(AddEditUser),
    handle: { title: 'New user' }
  },
  {
    path: ROUTES.ORGANIZATION.VIEW_USER,
    element: withSuspense(ViewUser),
    handle: { title: 'View user' }
  },
  {
    path: ROUTES.ORGANIZATION.EDIT_USER,
    element: withSuspense(AddEditUser),
    handle: { title: 'Edit user' }
  }
]
