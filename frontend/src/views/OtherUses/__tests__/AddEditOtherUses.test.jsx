import { describe, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { test } from '@/tests/utils/fixtures'
import { AddEditOtherUses } from '../AddEditOtherUses'

// Hook results must be stable objects: fresh ones each render re-trigger the
// page's data effects forever.
const { mockGridApi, gridEditorProps, hookResults } = vi.hoisted(() => ({
  mockGridApi: {
    sizeColumnsToFit: vi.fn(),
    getLastDisplayedRowIndex: vi.fn(() => 0),
    startEditingCell: vi.fn()
  },
  gridEditorProps: { current: null },
  hookResults: {
    navigate: vi.fn(),
    location: { state: null },
    params: { complianceReportId: '123', compliancePeriod: '2024' },
    translation: { t: (key) => key },
    options: {
      data: { fuelTypes: [], expectedUses: [] },
      isLoading: false,
      isFetched: true
    },
    uses: { data: [], isLoading: false },
    save: { mutateAsync: vi.fn() },
    report: { data: { report: { version: 0 } }, isLoading: false }
  }
}))

vi.mock('react-router-dom', async (orig) => ({
  ...(await orig()),
  useNavigate: () => hookResults.navigate,
  useLocation: () => hookResults.location,
  useParams: () => hookResults.params
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => hookResults.translation
}))

vi.mock('@/hooks/useOtherUses', () => ({
  useOtherUsesOptions: () => hookResults.options,
  useGetAllOtherUsesList: () => hookResults.uses,
  useSaveOtherUses: () => hookResults.save
}))

vi.mock('@/hooks/useComplianceReports', () => ({
  useComplianceReportWithCache: () => hookResults.report
}))

vi.mock('../_schema', async (orig) => {
  const colDefs = [{ field: 'fuelType' }]
  return { ...(await orig()), otherUsesColDefs: () => colDefs }
})

vi.mock('@/components/BCDataGrid/BCGridEditor', () => ({
  BCGridEditor: (props) => {
    gridEditorProps.current = props
    return (
      <button onClick={() => props.onGridReady({ api: mockGridApi })}>
        Grid Ready
      </button>
    )
  }
}))

describe('AddEditOtherUses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Fitting the columns to the viewport squeezed them (#5288)
  test('leaves column sizing to the grid', async ({ render, theme }) => {
    render(<AddEditOtherUses />, [theme])
    fireEvent.click(screen.getByText('Grid Ready'))

    await waitFor(() => {
      expect(mockGridApi.startEditingCell).toHaveBeenCalled()
    })
    expect(mockGridApi.sizeColumnsToFit).not.toHaveBeenCalled()
    expect(gridEditorProps.current.autoSizeStrategy).toBeUndefined()
  })
})
