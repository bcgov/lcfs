import {
  AddEditFuelCode,
  FuelCodes,
  MyFuelCodes,
  FuelCodeDetail
} from '@/views/FuelCodes'
import { FuelCodeBulletins } from '@/views/FuelCodeBulletins'
import ROUTES from '../routes'
import { AppRouteObject } from '../types'

export const fuelCodeRoutes: AppRouteObject[] = [
  {
    path: ROUTES.FUEL_CODES.BULLETINS,
    element: <FuelCodeBulletins />,
    handle: { title: 'Fuel codes' }
  },
  {
    path: ROUTES.FUEL_CODES.MY_LIST,
    element: <MyFuelCodes />,
    handle: { title: 'My fuel codes' }
  },
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
    path: ROUTES.FUEL_CODES.VIEW,
    element: <FuelCodeDetail />,
    handle: { title: 'Fuel code' }
  },
  {
    path: ROUTES.FUEL_CODES.EDIT,
    element: <AddEditFuelCode />,
    handle: { title: 'Fuel code' }
  }
]
