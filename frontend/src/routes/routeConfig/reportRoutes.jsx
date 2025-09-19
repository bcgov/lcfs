import { ComplianceReports, CreditCalculator } from '@/views/ComplianceReports'
import { ComplianceReportViewSelector } from '@/views/ComplianceReports/ComplianceReportViewSelector'
import ROUTES from '../routes'
import { AddEditNotionalTransfers } from '@/views/NotionalTransfers'
import { AddEditAllocationAgreements } from '@/views/AllocationAgreements/AddEditAllocationAgreements'
import { AddEditOtherUses } from '@/views/OtherUses/AddEditOtherUses'
import { AddEditFinalSupplyEquipments } from '@/views/FinalSupplyEquipments/AddEditFinalSupplyEquipments'
import { AddEditFuelSupplies } from '@/views/FuelSupplies/AddEditFuelSupplies'
import { AddEditFuelExports } from '@/views/FuelExports/AddEditFuelExports'
import { ReportsMenu } from '@/views/ComplianceReports/ReportsMenu'
import { AddEditChargingSite } from '@/views/ChargingSite/AddEditChargingSite'
import { ChargingSitesList } from '@/views/ChargingSite/ChargingSitesList'
import { ChargingEquipment as ChargingEquipmentList } from '@/views/ChargingEquipment'
import { AddEditChargingEquipment } from '@/views/ChargingEquipment/AddEditChargingEquipment'
import { Outlet } from 'react-router-dom'
import { ViewChargingSite } from '@/views/ChargingSite/ViewChargingSite'

export const reportRoutes = [
  {
    path: ROUTES.REPORTS.LIST,
    element: <ReportsMenu />,
    handle: { title: 'Compliance reporting' },
    children: [
      {
        path: 'manage-charging-sites',
        element: <ChargingSitesList />,
        handle: { title: 'Manage charging sites' },
        children: [
          {
            path: ':chargingSiteId',
            element: <ViewChargingSite />,
            handle: { title: 'View charging site' }
          },
          {
            path: 'add',
            element: <AddEditChargingSite mode="add" />,
            handle: { title: 'Add charging sites' }
          },
          {
            path: ':chargingSiteId/edit',
            element: <AddEditChargingSite mode="edit" />,
            handle: { title: 'Edit charging site' }
          }
        ]
      },
      {
        path: 'manage-fse',
        element: <ChargingEquipmentList />,
        handle: { title: 'Manage FSE' },
        children: [
          {
            path: 'new',
            element: <AddEditChargingEquipment mode="bulk" />,
            handle: { title: 'Add FSE' }
          },
          {
            path: ':id/edit',
            element: <AddEditChargingEquipment mode="single" />,
            handle: { title: 'Edit FSE' }
          }
        ]
      }
    ]
  },
  {
    path: ROUTES.REPORTS.CALCULATOR,
    element: <CreditCalculator />,
    handle: { title: 'Credit calculator' }
  },
  {
    path: ROUTES.REPORTS.VIEW,
    element: <ComplianceReportViewSelector />,
    handle: { title: '' }
  },
  {
    path: ROUTES.REPORTS.ADD.NOTIONAL_TRANSFERS,
    element: <AddEditNotionalTransfers />,
    handle: {
      title: 'Notional transfer of eligible renewable fuels',
      mode: 'add'
    }
  },
  {
    path: ROUTES.REPORTS.ADD.ALLOCATION_AGREEMENTS,
    element: <AddEditAllocationAgreements />,
    handle: {
      title: 'Allocation agreements',
      mode: 'add'
    }
  },
  {
    path: ROUTES.REPORTS.ADD.OTHER_USE_FUELS,
    element: <AddEditOtherUses />,
    handle: {
      title: 'Fuels for other use',
      mode: 'add'
    }
  },
  {
    path: ROUTES.REPORTS.ADD.FINAL_SUPPLY_EQUIPMENTS,
    element: <AddEditFinalSupplyEquipments />,
    handle: {
      title: 'Final supply equipment',
      mode: 'add'
    }
  },
  {
    path: ROUTES.REPORTS.ADD.SUPPLY_OF_FUEL,
    element: <AddEditFuelSupplies />,
    handle: {
      title: 'Supply of fuel',
      mode: 'add'
    }
  },
  {
    path: ROUTES.REPORTS.ADD.FUEL_EXPORTS,
    element: <AddEditFuelExports />,
    handle: {
      title: 'Export fuels',
      mode: 'add'
    }
  }
]
