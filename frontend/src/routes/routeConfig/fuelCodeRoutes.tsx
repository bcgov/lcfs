import { AddEditFuelCode, FuelCodes } from '@/views/FuelCodes'
import ROUTES from '../routes'
import { AppRouteObject } from '../types'

export const fuelCodeRoutes: AppRouteObject[] = [
  {
    path: ROUTES.FUEL_CODES.LIST,
    element: <FuelCodes />,
    handle: { title: 'Fuel codes' }
  },
  {
    path: ROUTES.FUEL_CODES.ADD,
    element: <AddEditFuelCode />,
    handle: { title: 'Add fuel code' }
  },
  {
    path: ROUTES.FUEL_CODES.EDIT,
    element: <AddEditFuelCode />,
    handle: { title: 'Fuel code' }
  }
]
