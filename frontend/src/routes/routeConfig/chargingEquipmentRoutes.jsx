import { lazy } from 'react'
import ROUTES from '../routes'
import { RoleRoute } from '@/components/RoleRoute'
import { roles } from '@/constants/roles'

// Lazy load components
const ChargingEquipment = lazy(() =>
  import('@/views/ChargingEquipment').then(module => ({
    default: module.ChargingEquipment
  }))
)

const AddEditChargingEquipment = lazy(() =>
  import('@/views/ChargingEquipment/AddEditChargingEquipment').then(module => ({
    default: module.AddEditChargingEquipment
  }))
)

export const chargingEquipmentRoutes = [
  {
    path: ROUTES.CHARGING_EQUIPMENT.LIST,
    element: (
      <RoleRoute allowedRoles={[...roles.supplier, ...roles.government]}>
        <ChargingEquipment />
      </RoleRoute>
    ),
    handle: { crumb: () => 'Charging Equipment' }
  },
  {
    path: ROUTES.CHARGING_EQUIPMENT.NEW,
    element: (
      <RoleRoute allowedRoles={roles.supplier}>
        <AddEditChargingEquipment />
      </RoleRoute>
    ),
    handle: { crumb: () => 'New Equipment' }
  },
  {
    path: ROUTES.CHARGING_EQUIPMENT.EDIT,
    element: (
      <RoleRoute allowedRoles={roles.supplier}>
        <AddEditChargingEquipment />
      </RoleRoute>
    ),
    handle: { crumb: () => 'Edit Equipment' }
  },
  {
    path: ROUTES.CHARGING_EQUIPMENT.VIEW,
    element: (
      <RoleRoute allowedRoles={[...roles.supplier, ...roles.government]}>
        <AddEditChargingEquipment />
      </RoleRoute>
    ),
    handle: { crumb: () => 'View Equipment' }
  }
]