// import React from 'react'
// import { render, screen, waitFor } from '@testing-library/react'
// import { describe, it, expect, beforeEach, vi } from 'vitest'
// import { OtherUsesChangelog } from '../OtherUsesChangelog'
// import { wrapper } from '@/tests/utils/wrapper'
// import { useGetChangeLog } from '@/hooks/useComplianceReports'

// // Mock hooks
// vi.mock('@/hooks/useComplianceReports')

// // Mock react-i18next
// vi.mock('react-i18next', () => ({
//   useTranslation: () => ({
//     t: (key) => key
//   })
// }))

// // Mock BCGridViewer
// vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
//   BCGridViewer: ({
//     gridKey,
//     columnDefs,
//     queryData,
//     getRowId,
//     suppressPagination,
//     gridOptions,
//     defaultColDef,
//     paginationOptions,
//     onPaginationChange
//   }) => (
//     <div data-test="bc-grid-viewer">
//       <div data-test="grid-key">{gridKey}</div>
//       <div data-test="row-count">
//         {queryData?.data?.items?.length || 0} rows
//       </div>
//       <div data-test="pagination-suppressed">
//         {suppressPagination ? 'pagination-suppressed' : 'pagination-enabled'}
//       </div>
//       <div data-test="has-pagination-options">
//         {paginationOptions ? 'has-pagination' : 'no-pagination'}
//       </div>
//       <div data-test="has-pagination-change">
//         {onPaginationChange ? 'has-change-handler' : 'no-change-handler'}
//       </div>
//       <div data-test="get-row-id">
//         {getRowId ? 'has-get-row-id' : 'no-get-row-id'}
//       </div>
//       {/* Simulate items for testing */}
//       {queryData?.data?.items?.map((item, index) => (
//         <div key={index} data-test="grid-item">
//           {item.otherUsesId} - {item.actionType}
//         </div>
//       ))}
//     </div>
//   )
// }))

// // Mock Loading component
// vi.mock('@/components/Loading', () => ({
//   default: () => <div data-test="loading-component">Loading...</div>
// }))

// // Mock the store
// vi.mock('@/stores/useComplianceReportStore', () => ({
//   default: () => ({
//     currentReport: {
//       report: {
//         complianceReportGroupUuid: 'test-group-uuid'
//       }
//     }
//   })
// }))

// // Mock schema
// vi.mock('./_schema', () => ({
//   changelogColDefs: () => [
//     { field: 'fuelType', headerName: 'Fuel Type' },
//     { field: 'actionType', headerName: 'Action' }
//   ],
//   changelogCommonColDefs: (highlight) => [
//     { field: 'fuelType', headerName: 'Fuel Type' },
//     { field: 'quantitySupplied', headerName: 'Quantity Supplied' }
//   ]
// }))

// // Mock constants
// vi.mock('@/constants/schedules.js', () => ({
//   defaultInitialPagination: {
//     page: 1,
//     size: 10,
//     filters: [],
//     sortOrders: []
//   }
// }))

// // Mock colors
// vi.mock('@/themes/base/colors', () => ({
//   default: {
//     alerts: {
//       error: { background: '#ffebee' },
//       success: { background: '#e8f5e8' }
//     }
//   }
// }))

// describe('OtherUsesChangelog', () => {
//   beforeEach(() => {
//     vi.resetAllMocks()
//   })

//   it('shows loading component when data is loading', () => {
//     vi.mocked(useGetChangeLog).mockReturnValue({
//       data: null,
//       isLoading: true
//     })

//     render(<OtherUsesChangelog />, { wrapper })
//     expect(screen.getByTestId('loading-component')).toBeInTheDocument()
//   })

//   it('renders empty state when no changelog data', () => {
//     vi.mocked(useGetChangeLog).mockReturnValue({
//       data: [],
//       isLoading: false
//     })

//     render(<OtherUsesChangelog />, { wrapper })

//     // Should render but with no changelog items
//     const grids = screen.queryAllByTestId('bc-grid-viewer')
//     expect(grids).toHaveLength(0)
//   })

//   it('renders single changelog item correctly', () => {
//     const mockChangelogData = [
//       {
//         version: 1,
//         nickname: 'Version 1.0',
//         otherUses: [
//           { otherUsesId: 1, fuelType: 'Diesel', actionType: 'CREATE' },
//           { otherUsesId: 2, fuelType: 'Gasoline', actionType: 'UPDATE' }
//         ]
//       }
//     ]

//     vi.mocked(useGetChangeLog).mockReturnValue({
//       data: mockChangelogData,
//       isLoading: false
//     })

//     render(<OtherUsesChangelog />, { wrapper })

//     expect(screen.getByText('Version 1.0')).toBeInTheDocument()
//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//     expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
//   })

//   it('renders multiple changelog items correctly', () => {
//     const mockChangelogData = [
//       {
//         version: 1,
//         nickname: 'Current Version',
//         otherUses: [
//           { otherUsesId: 1, fuelType: 'Diesel', actionType: 'CREATE' }
//         ]
//       },
//       {
//         version: 0,
//         nickname: 'Original Version',
//         otherUses: [
//           { otherUsesId: 2, fuelType: 'Gasoline', actionType: 'DELETE' }
//         ]
//       }
//     ]

//     vi.mocked(useGetChangeLog).mockReturnValue({
//       data: mockChangelogData,
//       isLoading: false
//     })

//     render(<OtherUsesChangelog />, { wrapper })

//     expect(screen.getByText('Current Version')).toBeInTheDocument()
//     expect(screen.getByText('Original Version')).toBeInTheDocument()

//     const grids = screen.getAllByTestId('bc-grid-viewer')
//     expect(grids).toHaveLength(2)
//   })

//   it('suppresses pagination for small datasets', () => {
//     const mockChangelogData = [
//       {
//         version: 1,
//         nickname: 'Small Dataset',
//         otherUses: Array.from({ length: 5 }, (_, i) => ({
//           otherUsesId: i + 1,
//           fuelType: `Fuel ${i + 1}`,
//           actionType: 'CREATE'
//         }))
//       }
//     ]

//     vi.mocked(useGetChangeLog).mockReturnValue({
//       data: mockChangelogData,
//       isLoading: false
//     })

//     render(<OtherUsesChangelog />, { wrapper })

//     expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
//       'pagination-suppressed'
//     )
//     expect(screen.getByTestId('has-pagination-options')).toHaveTextContent(
//       'no-pagination'
//     )
//     expect(screen.getByTestId('has-pagination-change')).toHaveTextContent(
//       'no-change-handler'
//     )
//   })

//   it('enables pagination for large datasets', () => {
//     const mockChangelogData = [
//       {
//         version: 1,
//         nickname: 'Large Dataset',
//         otherUses: Array.from({ length: 15 }, (_, i) => ({
//           otherUsesId: i + 1,
//           fuelType: `Fuel ${i + 1}`,
//           actionType: 'CREATE'
//         }))
//       }
//     ]

//     vi.mocked(useGetChangeLog).mockReturnValue({
//       data: mockChangelogData,
//       isLoading: false
//     })

//     render(<OtherUsesChangelog />, { wrapper })

//     expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
//       'pagination-enabled'
//     )
//     expect(screen.getByTestId('has-pagination-options')).toHaveTextContent(
//       'has-pagination'
//     )
//     expect(screen.getByTestId('has-pagination-change')).toHaveTextContent(
//       'has-change-handler'
//     )
//   })

//   it('uses different column definitions for current/original vs other versions', () => {
//     const mockChangelogData = [
//       {
//         version: 1,
//         nickname: 'Current Version',
//         otherUses: [
//           { otherUsesId: 1, fuelType: 'Diesel', actionType: 'CREATE' }
//         ]
//       },
//       {
//         version: 2,
//         nickname: 'Middle Version',
//         otherUses: [
//           { otherUsesId: 2, fuelType: 'Gasoline', actionType: 'UPDATE' }
//         ]
//       },
//       {
//         version: 0,
//         nickname: 'Original Version',
//         otherUses: [
//           { otherUsesId: 3, fuelType: 'Biodiesel', actionType: 'DELETE' }
//         ]
//       }
//     ]

//     vi.mocked(useGetChangeLog).mockReturnValue({
//       data: mockChangelogData,
//       isLoading: false
//     })

//     render(<OtherUsesChangelog />, { wrapper })

//     const grids = screen.getAllByTestId('bc-grid-viewer')
//     expect(grids).toHaveLength(3)

//     // All should have getRowId function
//     const getRowIdElements = screen.getAllByTestId('get-row-id')
//     getRowIdElements.forEach((element) => {
//       expect(element).toHaveTextContent('has-get-row-id')
//     })
//   })

//   it('handles empty other uses array', () => {
//     const mockChangelogData = [
//       {
//         version: 1,
//         nickname: 'Empty Version',
//         otherUses: []
//       }
//     ]

//     vi.mocked(useGetChangeLog).mockReturnValue({
//       data: mockChangelogData,
//       isLoading: false
//     })

//     render(<OtherUsesChangelog />, { wrapper })

//     expect(screen.getByText('Empty Version')).toBeInTheDocument()
//     expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
//     expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
//       'pagination-suppressed'
//     )
//   })

//   it('handles missing store data gracefully', () => {
//     // Mock empty store
//     vi.doMock('@/stores/useComplianceReportStore', () => ({
//       default: () => ({
//         currentReport: null
//       })
//     }))

//     vi.mocked(useGetChangeLog).mockReturnValue({
//       data: [],
//       isLoading: false
//     })

//     render(<OtherUsesChangelog />, { wrapper })

//     // Should render without errors
//     const grids = screen.queryAllByTestId('bc-grid-viewer')
//     expect(grids).toHaveLength(0)
//   })

//   it('generates unique grid keys for multiple versions', () => {
//     const mockChangelogData = [
//       {
//         version: 1,
//         nickname: 'Version 1',
//         otherUses: [
//           { otherUsesId: 1, fuelType: 'Diesel', actionType: 'CREATE' }
//         ]
//       },
//       {
//         version: 2,
//         nickname: 'Version 2',
//         otherUses: [
//           { otherUsesId: 2, fuelType: 'Gasoline', actionType: 'UPDATE' }
//         ]
//       }
//     ]

//     vi.mocked(useGetChangeLog).mockReturnValue({
//       data: mockChangelogData,
//       isLoading: false
//     })

//     render(<OtherUsesChangelog />, { wrapper })

//     const gridKeys = screen.getAllByTestId('grid-key')
//     expect(gridKeys[0]).toHaveTextContent('other-uses-changelog-0')
//     expect(gridKeys[1]).toHaveTextContent('other-uses-changelog-1')
//   })

//   it('correctly identifies current and original versions', async () => {
//     const mockChangelogData = [
//       {
//         version: 2, // Current (index 0)
//         nickname: 'Current Version',
//         otherUses: [
//           { otherUsesId: 1, fuelType: 'Diesel', actionType: 'CREATE' }
//         ]
//       },
//       {
//         version: 1, // Middle version
//         nickname: 'Middle Version',
//         otherUses: [
//           { otherUsesId: 2, fuelType: 'Gasoline', actionType: 'UPDATE' }
//         ]
//       },
//       {
//         version: 0, // Original version
//         nickname: 'Original Version',
//         otherUses: [
//           { otherUsesId: 3, fuelType: 'Biodiesel', actionType: 'DELETE' }
//         ]
//       }
//     ]

//     vi.mocked(useGetChangeLog).mockReturnValue({
//       data: mockChangelogData,
//       isLoading: false
//     })

//     render(<OtherUsesChangelog />, { wrapper })

//     await waitFor(() => {
//       const grids = screen.getAllByTestId('bc-grid-viewer')
//       expect(grids).toHaveLength(3)
//     })
//   })

//   it('handles pagination state management correctly', () => {
//     const mockChangelogData = [
//       {
//         version: 1,
//         nickname: 'Paginated Version',
//         otherUses: Array.from({ length: 15 }, (_, i) => ({
//           otherUsesId: i + 1,
//           fuelType: `Fuel ${i + 1}`,
//           actionType: 'CREATE'
//         }))
//       }
//     ]

//     vi.mocked(useGetChangeLog).mockReturnValue({
//       data: mockChangelogData,
//       isLoading: false
//     })

//     render(<OtherUsesChangelog />, { wrapper })

//     // Should show first 10 items (default page size)
//     expect(screen.getByTestId('row-count')).toHaveTextContent('10 rows')
//     expect(screen.getByTestId('has-pagination-change')).toHaveTextContent(
//       'has-change-handler'
//     )
//   })

//   // it('calls useGetChangeLog with correct parameters', () => {
//   //   const mockGetChangeLog = vi.mocked(useGetChangeLog)

//   //   render(<OtherUsesChangelog />, { wrapper })

//   //   expect(mockGetChangeLog).toHaveBeenCalledWith({
//   //     complianceReportGroupUuid: 'test-group-uuid',
//   //     dataType: 'other-uses'
//   //   })
//   // })

//   it('uses correct overlay template for no rows', () => {
//     const mockChangelogData = [
//       {
//         version: 1,
//         nickname: 'Empty Version',
//         otherUses: []
//       }
//     ]

//     vi.mocked(useGetChangeLog).mockReturnValue({
//       data: mockChangelogData,
//       isLoading: false
//     })

//     render(<OtherUsesChangelog />, { wrapper })

//     // Component should render with the correct overlay template
//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//   })

//   it('handles undefined changelog data', () => {
//     vi.mocked(useGetChangeLog).mockReturnValue({
//       data: undefined,
//       isLoading: false
//     })

//     render(<OtherUsesChangelog />, { wrapper })

//     // Should render without errors
//     const grids = screen.queryAllByTestId('bc-grid-viewer')
//     expect(grids).toHaveLength(0)
//   })

//   it('applies correct row styling based on action type', () => {
//     const mockChangelogData = [
//       {
//         version: 1,
//         nickname: 'Test Version',
//         otherUses: [
//           { otherUsesId: 1, fuelType: 'Diesel', actionType: 'CREATE' },
//           { otherUsesId: 2, fuelType: 'Gasoline', actionType: 'DELETE' }
//         ]
//       }
//     ]

//     vi.mocked(useGetChangeLog).mockReturnValue({
//       data: mockChangelogData,
//       isLoading: false
//     })

//     render(<OtherUsesChangelog />, { wrapper })

//     // Component should render with styling options available
//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//   })

//   it('handles client-side filtering and sorting', () => {
//     const mockChangelogData = [
//       {
//         version: 1,
//         nickname: 'Filterable Version',
//         otherUses: Array.from({ length: 15 }, (_, i) => ({
//           otherUsesId: i + 1,
//           fuelType: i % 2 === 0 ? 'Diesel' : 'Gasoline',
//           actionType: 'CREATE'
//         }))
//       }
//     ]

//     vi.mocked(useGetChangeLog).mockReturnValue({
//       data: mockChangelogData,
//       isLoading: false
//     })

//     render(<OtherUsesChangelog />, { wrapper })

//     // Component should render with pagination enabled for filtering/sorting
//     expect(screen.getByTestId('has-pagination-change')).toHaveTextContent(
//       'has-change-handler'
//     )
//     expect(screen.getByTestId('row-count')).toHaveTextContent('10 rows')
//   })
// })
describe.todo()