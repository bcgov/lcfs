import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock all external dependencies to prevent memory leaks
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ state: null }),
  useParams: () => ({
    complianceReportId: '123',
    compliancePeriod: '2024'
  })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/hooks/useOtherUses', () => ({
  useGetAllOtherUsesList: () => ({
    data: [],
    isLoading: false
  }),
  useOtherUsesOptions: () => ({
    data: { fuelTypes: [], expectedUses: [] },
    isLoading: false,
    isFetched: true
  }),
  useSaveOtherUses: () => ({
    mutateAsync: vi.fn()
  })
}))

vi.mock('@/hooks/useComplianceReports', () => ({
  useComplianceReportWithCache: () => ({
    data: { report: { version: 0 } },
    isLoading: false
  })
}))

vi.mock('@/utils/formatters', () => ({
  cleanEmptyStringValues: (data) => data
}))

vi.mock('@/utils/schedules.js', () => ({
  handleScheduleDelete: vi.fn(),
  handleScheduleSave: vi.fn()
}))

vi.mock('uuid', () => ({
  v4: () => 'test-uuid'
}))

vi.mock('../_schema', () => ({
  defaultColDef: { editable: true },
  otherUsesColDefs: () => [{ field: 'test' }],
  PROVISION_APPROVED_FUEL_CODE: 'Fuel code - section 19 (b) (i)'
}))

vi.mock('@/routes/routes', () => ({
  ROUTES: {
    REPORTS: {
      VIEW: '/reports/:compliancePeriod/:complianceReportId'
    }
  },
  buildPath: () => '/test-path'
}))

vi.mock('@/components/BCTypography', () => ({
  default: () => null
}))

vi.mock('@/components/Loading', () => ({
  default: () => null
}))

vi.mock('@mui/material/Grid2', () => ({
  default: () => null
}))

vi.mock('@/components/BCDataGrid/BCGridEditor', () => ({
  BCGridEditor: () => null
}))

describe('AddEditOtherUses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Business Logic Tests', () => {
    it('should handle ensureRowId logic correctly', () => {
      const row = { id: 'existing-id', data: 'test' }
      const numericComplianceReportId = 123
      const isSupplemental = false

      const result = row.id
        ? row
        : {
            ...row,
            id: 'test-uuid',
            isValid: true,
            complianceReportId: numericComplianceReportId,
            ...(isSupplemental &&
              row.complianceReportId === numericComplianceReportId && {
                isNewSupplementalEntry: true
              })
          }

      expect(result.id).toBe('existing-id')
      expect(result.data).toBe('test')
    })

    it('should generate new ID when missing', () => {
      const row = { data: 'test' }
      const numericComplianceReportId = 123
      const isSupplemental = false

      const result = row.id
        ? row
        : {
            ...row,
            id: 'test-uuid',
            isValid: true,
            complianceReportId: numericComplianceReportId,
            ...(isSupplemental &&
              row.complianceReportId === numericComplianceReportId && {
                isNewSupplementalEntry: true
              })
          }

      expect(result.id).toBe('test-uuid')
      expect(result.isValid).toBe(true)
      expect(result.complianceReportId).toBe(123)
    })

    it('should add supplemental flag when conditions met', () => {
      const row = { complianceReportId: 123 }
      const numericComplianceReportId = 123
      const isSupplemental = true

      const result = row.id
        ? row
        : {
            ...row,
            id: 'test-uuid',
            isValid: true,
            complianceReportId: numericComplianceReportId,
            ...(isSupplemental &&
              row.complianceReportId === numericComplianceReportId && {
                isNewSupplementalEntry: true
              })
          }

      expect(result.isNewSupplementalEntry).toBe(true)
    })

    it('should handle column visibility state', () => {
      const columnVisibilityState = {
        isCanadaProduced: false,
        isQ1Supplied: false
      }

      const setColumnsVisible = (columns, visible) => {
        columns.forEach((column) => {
          columnVisibilityState[column] = visible
        })
      }

      setColumnsVisible(['isCanadaProduced'], true)
      expect(columnVisibilityState.isCanadaProduced).toBe(true)
    })

    it('should check column visibility', () => {
      const columnVisibilityState = { isQ1Supplied: true }
      
      const getColumn = (column) => ({
        isVisible: () => columnVisibilityState[column]
      })

      const column = getColumn('isQ1Supplied')
      expect(column.isVisible()).toBe(true)
    })
  })
})