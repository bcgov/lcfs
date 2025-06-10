// import { useComplianceReportWithCache } from '@/hooks/useComplianceReports'
// import {
//   useGetAllNotionalTransfersList,
//   useNotionalTransferOptions,
//   useSaveNotionalTransfer
// } from '@/hooks/useNotionalTransfer'
// import { wrapper } from '@/tests/utils/wrapper'
// import { render, screen, waitFor } from '@testing-library/react'
// import { beforeEach, describe, expect, it, vi } from 'vitest'
// import { AddEditNotionalTransfers } from '../AddEditNotionalTransfers'

// // Mock react-router-dom hooks
// const mockUseLocation = vi.fn()
// const mockUseNavigate = vi.fn()
// const mockUseParams = vi.fn()

// vi.mock('react-router-dom', () => ({
//   ...vi.importActual('react-router-dom'),
//   useLocation: () => mockUseLocation(),
//   useNavigate: () => mockUseNavigate(),
//   useParams: () => mockUseParams()
// }))

// // Mock react-i18next
// vi.mock('react-i18next', () => ({
//   useTranslation: () => ({
//     t: (key) => key
//   })
// }))

// // Mock all hooks
// vi.mock('@/hooks/useComplianceReports')
// vi.mock('@/hooks/useNotionalTransfer')

// // Mock BCGridEditor
// vi.mock('@/components/BCDataGrid/BCGridEditor', () => ({
//   BCGridEditor: ({
//     gridRef,
//     alertRef,
//     onGridReady,
//     rowData,
//     onCellEditingStopped,
//     onAction,
//     loading
//   }) => (
//     <div data-test="bc-grid-editor">
//       <div data-test="loading">{loading ? 'loading' : 'not-loading'}</div>
//       <div data-test="row-data">
//         {rowData.map((row, index) => (
//           <div key={index} data-test="grid-row">
//             {row.id} - {row.legalName || 'empty'}
//           </div>
//         ))}
//       </div>
//       <button
//         data-test="trigger-grid-ready"
//         onClick={() => {
//           const mockParams = {
//             api: {
//               sizeColumnsToFit: vi.fn(),
//               getLastDisplayedRowIndex: () => 0,
//               startEditingCell: vi.fn()
//             }
//           }
//           onGridReady(mockParams)
//         }}
//       >
//         Trigger Grid Ready
//       </button>
//     </div>
//   )
// }))

// // Mock Loading component
// vi.mock('@/components/Loading', () => ({
//   default: () => <div data-test="loading-component">Loading...</div>
// }))

// // Mock schema
// vi.mock('./_schema', () => ({
//   defaultColDef: {},
//   notionalTransferColDefs: (
//     optionsData,
//     orgName,
//     errors,
//     warnings,
//     isSupplemental,
//     compliancePeriod,
//     isEarlyIssuance
//   ) => [
//     { field: 'legalName', headerName: 'Legal Name' },
//     { field: 'quantity', headerName: 'Quantity' }
//   ]
// }))

// // Mock utility functions
// vi.mock('@/utils/schedules.js', () => ({
//   handleScheduleDelete: vi.fn(),
//   handleScheduleSave: vi.fn().mockResolvedValue({ saved: true })
// }))

// describe('AddEditNotionalTransfers', () => {
//   const mockNavigate = vi.fn()

//   beforeEach(() => {
//     vi.resetAllMocks()

//     // Mock router hooks
//     mockUseLocation.mockReturnValue({
//       pathname: '/test-path',
//       state: {}
//     })
//     mockUseNavigate.mockReturnValue(mockNavigate)
//     mockUseParams.mockReturnValue({
//       complianceReportId: 'testReportId',
//       compliancePeriod: '2024-Q1'
//     })

//     // Mock useComplianceReportWithCache
//     vi.mocked(useComplianceReportWithCache).mockReturnValue({
//       data: {
//         report: {
//           version: 0,
//           reportingFrequency: 'ANNUAL',
//           organization: { name: 'Test Organization' }
//         }
//       },
//       isLoading: false
//     })

//     // Mock useNotionalTransferOptions
//     vi.mocked(useNotionalTransferOptions).mockReturnValue({
//       data: { organizations: [] },
//       isLoading: false,
//       isFetched: true
//     })

//     // Mock useGetAllNotionalTransfersList
//     vi.mocked(useGetAllNotionalTransfersList).mockReturnValue({
//       data: [],
//       isLoading: false
//     })

//     // Mock useSaveNotionalTransfer
//     vi.mocked(useSaveNotionalTransfer).mockReturnValue({
//       mutateAsync: vi.fn()
//     })
//   })

//   it('shows loading component when options are loading', () => {
//     vi.mocked(useNotionalTransferOptions).mockReturnValue({
//       data: null,
//       isLoading: true,
//       isFetched: false
//     })

//     render(<AddEditNotionalTransfers />, { wrapper })
//     expect(screen.getByTestId('loading-component')).toBeInTheDocument()
//   })

//   it('shows loading component when transfers are loading', () => {
//     vi.mocked(useGetAllNotionalTransfersList).mockReturnValue({
//       data: null,
//       isLoading: true
//     })

//     render(<AddEditNotionalTransfers />, { wrapper })
//     expect(screen.getByTestId('loading-component')).toBeInTheDocument()
//   })

//   it('renders the component when data is loaded', () => {
//     render(<AddEditNotionalTransfers />, { wrapper })

//     expect(
//       screen.getByText('notionalTransfer:newNotionalTransferTitle')
//     ).toBeInTheDocument()
//     expect(
//       screen.getByText('notionalTransfer:newNotionalTransferGuide')
//     ).toBeInTheDocument()
//     expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
//   })

//   it('initializes with one empty row when no existing transfers', () => {
//     render(<AddEditNotionalTransfers />, { wrapper })

//     const rows = screen.getAllByTestId('grid-row')
//     expect(rows.length).toBe(1)
//     expect(rows[0]).toHaveTextContent('empty')
//   })

//   it('loads existing notional transfers when available', () => {
//     vi.mocked(useGetAllNotionalTransfersList).mockReturnValue({
//       data: [
//         { notionalTransferId: 1, legalName: 'Organization A', quantity: 100 },
//         { notionalTransferId: 2, legalName: 'Organization B', quantity: 200 }
//       ],
//       isLoading: false
//     })

//     render(<AddEditNotionalTransfers />, { wrapper })

//     const rows = screen.getAllByTestId('grid-row')
//     // Should have 2 existing rows + 1 empty row
//     expect(rows.length).toBe(3)
//     expect(rows[0]).toHaveTextContent('Organization A')
//     expect(rows[1]).toHaveTextContent('Organization B')
//     expect(rows[2]).toHaveTextContent('empty')
//   })

//   it('handles supplemental report correctly', () => {
//     vi.mocked(useComplianceReportWithCache).mockReturnValue({
//       data: {
//         report: {
//           version: 1, // Supplemental report
//           reportingFrequency: 'ANNUAL',
//           organization: { name: 'Test Organization' }
//         }
//       },
//       isLoading: false
//     })

//     render(<AddEditNotionalTransfers />, { wrapper })
//     expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
//   })

//   it('handles early issuance report correctly', () => {
//     vi.mocked(useComplianceReportWithCache).mockReturnValue({
//       data: {
//         report: {
//           version: 0,
//           reportingFrequency: 'QUARTERLY', // Early issuance
//           organization: { name: 'Test Organization' }
//         }
//       },
//       isLoading: false
//     })

//     render(<AddEditNotionalTransfers />, { wrapper })
//     expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
//   })

//   it('handles grid ready callback', async () => {
//     vi.mocked(useGetAllNotionalTransfersList).mockReturnValue({
//       data: [{ notionalTransferId: 1, legalName: 'Organization A' }],
//       isLoading: false
//     })

//     render(<AddEditNotionalTransfers />, { wrapper })

//     const triggerButton = screen.getByTestId('trigger-grid-ready')
//     triggerButton.click()

//     await waitFor(() => {
//       const rows = screen.getAllByTestId('grid-row')
//       expect(rows.length).toBeGreaterThan(0)
//     })
//   })

//   it('sets correct row data structure for new entries', () => {
//     render(<AddEditNotionalTransfers />, { wrapper })

//     const rows = screen.getAllByTestId('grid-row')
//     expect(rows.length).toBe(1)
//     // Should have an ID (UUID) assigned
//     expect(rows[0].textContent).toMatch(/^[a-f0-9-]+ - empty$/)
//   })

//   it('sets correct row data structure for existing entries', () => {
//     vi.mocked(useGetAllNotionalTransfersList).mockReturnValue({
//       data: [
//         {
//           notionalTransferId: 1,
//           legalName: 'Test Org',
//           complianceReportId: 'testReportId'
//         }
//       ],
//       isLoading: false
//     })

//     render(<AddEditNotionalTransfers />, { wrapper })

//     const rows = screen.getAllByTestId('grid-row')
//     expect(rows.length).toBe(2) // 1 existing + 1 empty
//     expect(rows[0]).toHaveTextContent('Test Org')
//   })

//   it('handles empty notional transfers data', () => {
//     vi.mocked(useGetAllNotionalTransfersList).mockReturnValue({
//       data: null,
//       isLoading: false
//     })

//     render(<AddEditNotionalTransfers />, { wrapper })

//     const rows = screen.getAllByTestId('grid-row')
//     expect(rows.length).toBe(1)
//     expect(rows[0]).toHaveTextContent('empty')
//   })

//   it('does not render when not fetched', () => {
//     vi.mocked(useNotionalTransferOptions).mockReturnValue({
//       data: null,
//       isLoading: false,
//       isFetched: false
//     })

//     const { container } = render(<AddEditNotionalTransfers />, { wrapper })
//     expect(container.firstChild).toBeNull()
//   })

//   it('does not render when compliance report is loading', () => {
//     vi.mocked(useComplianceReportWithCache).mockReturnValue({
//       data: null,
//       isLoading: true
//     })

//     const { container } = render(<AddEditNotionalTransfers />, { wrapper })
//     expect(container.firstChild).toBeNull()
//   })

//   it('handles missing organization name gracefully', () => {
//     vi.mocked(useComplianceReportWithCache).mockReturnValue({
//       data: {
//         report: {
//           version: 0,
//           reportingFrequency: 'ANNUAL',
//           organization: null
//         }
//       },
//       isLoading: false
//     })

//     render(<AddEditNotionalTransfers />, { wrapper })
//     expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
//   })
// })
describe.todo()