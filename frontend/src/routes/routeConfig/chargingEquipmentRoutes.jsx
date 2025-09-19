import { lazy } from 'react'
import ROUTES from '../routes'
// TODO: Implement RoleRoute component for role-based access control
// import { RoleRoute } from '@/components/RoleRoute'
// import { roles } from '@/constants/roles'

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
    element: <ChargingEquipment />,
    handle: { crumb: () => 'Charging Equipment' }
  },
  {
    path: ROUTES.CHARGING_EQUIPMENT.NEW,
    element: <AddEditChargingEquipment />,
    handle: { crumb: () => 'New Equipment' }
  },
  {
    path: ROUTES.CHARGING_EQUIPMENT.EDIT,
    element: <AddEditChargingEquipment />,
    handle: { crumb: () => 'Edit Equipment' }
  },
  {
    path: ROUTES.CHARGING_EQUIPMENT.VIEW,
    element: <AddEditChargingEquipment />,
    handle: { crumb: () => 'View Equipment' }
  }
]