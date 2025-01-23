import React, { lazy, Suspense } from 'react'
import ROUTES from '../routes'

// Lazy-loaded components
const FuelCodes = lazy(() => import('@/views/FuelCodes/FuelCodes'))
const AddEditFuelCode = lazy(() => import('@/views/FuelCodes/AddEditFuelCode'))

// Utility function to wrap components with Suspense
const withSuspense = (Component, props = {}) => (
  <Suspense fallback={<div>Loading...</div>}>
    <Component {...props} />
  </Suspense>
)

export const fuelCodeRoutes = [
  {
    path: ROUTES.FUEL_CODES,
    element: withSuspense(FuelCodes),
    handle: { title: 'Fuel codes' }
  },
  {
    path: ROUTES.FUEL_CODES.ADD,
    element: withSuspense(AddEditFuelCode),
    handle: { title: 'Add Fuel Code' }
  },
  {
    path: ROUTES.FUEL_CODES.EDIT,
    element: withSuspense(AddEditFuelCode),
    handle: { title: 'Fuel Code' }
  }
]
