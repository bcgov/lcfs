import { ChargingSiteEquipmentProcessing } from '@/views/ChargingSite/ChargingSiteEquipmentProcessing'
import ROUTES from '../routes'

export const chargingSiteRoutes = [
  {
    path: ROUTES.CHARGING_SITES.EQUIPMENT_PROCESSING,
    element: <ChargingSiteEquipmentProcessing />,
    handle: { title: 'Charging site/Equipment processing' }
  }
]
