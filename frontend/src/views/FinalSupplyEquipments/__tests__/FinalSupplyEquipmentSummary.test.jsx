import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FinalSupplyEquipmentSummary } from '../FinalSupplyEquipmentSummary'
import { wrapper } from '@/tests/utils/wrapper'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

// -------- mocks -------- //
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

// Mock react-router params
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ complianceReportId: 'abc' })
  }
})

// Capture the props sent to BCGridViewer for assertions
let gridViewerProps
vi.mock('@/components/BCDataGrid/BCGridViewer.jsx', () => ({
  BCGridViewer: (props) => {
    gridViewerProps = props
    return <div data-test="bc-grid-viewer" />
  }
}))

vi.mock('@/views/FinalSupplyEquipments/_schema.jsx', () => ({
  finalSupplyEquipmentSummaryColDefs: () => [
    { field: 'organizationName', headerName: 'Org Name' },
    { field: 'serialNbr', headerName: 'Serial #' }
  ]
}))

vi.mock('@/utils/grid/cellRenderers', () => ({
  LinkRenderer: () => <span data-test="link-renderer" />
}))

// We stub GeoMapping so we can assert its conditional rendering
vi.mock('../GeoMapping', () => ({
  default: () => <div data-test="geo-mapping" />
}))

// -------- helper -------- //
const sampleData = [
  {
    finalSupplyEquipmentId: 1,
    organizationName: 'Org 1',
    serialNbr: 'SN1'
  },
  {
    finalSupplyEquipmentId: 2,
    organizationName: 'Org 2',
    serialNbr: 'SN2'
  }
]

const renderComponent = () =>
  render(
    <FinalSupplyEquipmentSummary
      data={{ finalSupplyEquipments: sampleData }}
      status={COMPLIANCE_REPORT_STATUSES.DRAFT}
    />,
    { wrapper }
  )

// -------- tests -------- //

describe('FinalSupplyEquipmentSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    gridViewerProps = undefined
  })

  it('passes correct props to BCGridViewer', () => {
    renderComponent()

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(gridViewerProps.gridKey).toBe('final-supply-equipments')
    expect(gridViewerProps.dataKey).toBe('finalSupplyEquipments')
    // Suppress pagination when <=10 rows
    expect(gridViewerProps.suppressPagination).toBe(true)
    // getRowId should map id to string
    const rowId = gridViewerProps.getRowId({
      data: { finalSupplyEquipmentId: 42 }
    })
    expect(rowId).toBe('42')
  })

  it('toggles GeoMapping on switch click', async () => {
    const user = userEvent.setup()
    renderComponent()

    // At first GeoMapping not rendered
    expect(screen.queryByTestId('geo-mapping')).not.toBeInTheDocument()

    // Find the MUI Switch (role="checkbox") and click it
    const switchEl = screen.getByRole('checkbox')
    await user.click(switchEl)

    expect(screen.getByTestId('geo-mapping')).toBeInTheDocument()
  })
})
