import React, { lazy, Suspense } from 'react'
import ROUTES from '../routes'

// Lazy-loaded components
const ComplianceReports = lazy(() => import('@/views/ComplianceReports'))
const CompareReports = lazy(
  () => import('@/views/CompareReports/CompareReports')
)
const ComplianceReportViewSelector = lazy(
  () => import('@/views/ComplianceReports/ComplianceReportViewSelector')
)
const AddEditNotionalTransfers = lazy(() => import('@/views/NotionalTransfers'))
const AddEditAllocationAgreements = lazy(
  () => import('@/views/AllocationAgreements/AddEditAllocationAgreements')
)
const AddEditOtherUses = lazy(
  () => import('@/views/OtherUses/AddEditOtherUses')
)
const AddEditFinalSupplyEquipments = lazy(
  () => import('@/views/FinalSupplyEquipments/AddEditFinalSupplyEquipments')
)
const AddEditFuelSupplies = lazy(
  () => import('@/views/FuelSupplies/AddEditFuelSupplies')
)
const AddEditFuelExports = lazy(
  () => import('@/views/FuelExports/AddEditFuelExports')
)

// Utility function to wrap components with Suspense
const withSuspense = (Component, props = {}) => (
  <Suspense fallback={<div>Loading...</div>}>
    <Component {...props} />
  </Suspense>
)

export const reportRoutes = [
  {
    path: ROUTES.REPORTS,
    element: withSuspense(ComplianceReports),
    handle: { title: 'Compliance reporting' }
  },
  {
    path: ROUTES.REPORTS.COMPARE,
    element: withSuspense(CompareReports),
    handle: { title: 'Compare reports' }
  },
  {
    path: ROUTES.REPORTS.VIEW,
    element: withSuspense(ComplianceReportViewSelector),
    handle: { title: '' }
  },
  {
    path: ROUTES.REPORTS.ADD.NOTIONAL_TRANSFERS,
    element: withSuspense(AddEditNotionalTransfers),
    handle: {
      title: 'Notional transfer of eligible renewable fuels',
      mode: 'add'
    }
  },
  {
    path: ROUTES.REPORTS.ADD.ALLOCATION_AGREEMENTS,
    element: withSuspense(AddEditAllocationAgreements),
    handle: {
      title: 'Allocation agreements',
      mode: 'add'
    }
  },
  {
    path: ROUTES.REPORTS.ADD.OTHER_USE_FUELS,
    element: withSuspense(AddEditOtherUses),
    handle: {
      title: 'Fuels for other use',
      mode: 'add'
    }
  },
  {
    path: ROUTES.REPORTS.ADD.FINAL_SUPPLY_EQUIPMENTS,
    element: withSuspense(AddEditFinalSupplyEquipments),
    handle: {
      title: 'Final supply equipment',
      mode: 'add'
    }
  },
  {
    path: ROUTES.REPORTS.ADD.SUPPLY_OF_FUEL,
    element: withSuspense(AddEditFuelSupplies),
    handle: {
      title: 'Supply of fuel',
      mode: 'add'
    }
  },
  {
    path: ROUTES.REPORTS.ADD.FUEL_EXPORTS,
    element: withSuspense(AddEditFuelExports),
    handle: {
      title: 'Export fuels',
      mode: 'add'
    }
  }
]
