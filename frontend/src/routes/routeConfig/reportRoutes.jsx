import { ComplianceReports } from '@/views/ComplianceReports'
import { CompareReports } from '@/views/CompareReports/CompareReports'
import { ComplianceReportViewSelector } from '@/views/ComplianceReports/ComplianceReportViewSelector'
import ROUTES from '../routes'
import { AddEditNotionalTransfers } from '@/views/NotionalTransfers'
import { AddEditAllocationAgreements } from '@/views/AllocationAgreements/AddEditAllocationAgreements'
import { AddEditOtherUses } from '@/views/OtherUses/AddEditOtherUses'
import { AddEditFinalSupplyEquipments } from '@/views/FinalSupplyEquipments/AddEditFinalSupplyEquipments'
import { AddEditFuelSupplies } from '@/views/FuelSupplies/AddEditFuelSupplies'
import { AddEditFuelExports } from '@/views/FuelExports/AddEditFuelExports'
import { element } from 'prop-types'
import { FuelSupplyChangelog } from '@/views/FuelSupplies/FuelSupplyChangelog'
import { NotionalTransferChangelog } from '@/views/NotionalTransfers/NotionalTransferChangelog'
import { OtherUsesChangelog } from '@/views/OtherUses/OtherUsesChangelog'
import { FuelExportChangelog } from '@/views/FuelExports/FuelExportChangelog'

export const reportRoutes = [
  {
    path: ROUTES.REPORTS.LIST,
    element: <ComplianceReports />,
    handle: { title: 'Compliance reporting' }
  },
  {
    path: ROUTES.REPORTS.COMPARE,
    element: <CompareReports />,
    handle: { title: 'Compare reports' }
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
  },
  {
    path: ROUTES.REPORTS.CHANGELOG.SUPPLY_OF_FUEL,
    element: <FuelSupplyChangelog />,
    handle: {
      title: 'Fuel Supply Changelog'
    }
  },
  {
    path: ROUTES.REPORTS.CHANGELOG.NOTIONAL_TRANSFERS,
    element: <NotionalTransferChangelog />,
    handle: {
      title: 'Notional Transfers Changelog'
    }
  },
  {
    path: ROUTES.REPORTS.CHANGELOG.OTHER_USE_FUELS,
    element: <OtherUsesChangelog />,
    handle: {
      title: 'Other Use Fuels Changelog'
    }
  },
  {
    path: ROUTES.REPORTS.CHANGELOG.FUEL_EXPORTS,
    element: <FuelExportChangelog />,
    handle: {
      title: 'Fuel Exports Changelog'
    }
  }
]
