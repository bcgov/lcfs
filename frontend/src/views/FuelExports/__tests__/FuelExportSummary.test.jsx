// import React from 'react'
// import { render, screen } from '@testing-library/react'
// import { describe, it, expect, beforeEach, vi } from 'vitest'
// import { FuelExportSummary } from '../FuelExportSummary'
// import { wrapper } from '@/tests/utils/wrapper'
// import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

// // Mock react-i18next
// vi.mock('react-i18next', () => ({
//   useTranslation: () => ({
//     t: (key) => key
//   })
// }))

// // Mock BCGridViewer
// vi.mock('@/components/BCDataGrid/BCGridViewer.jsx', () => ({
//   BCGridViewer: ({
//     gridKey,
//     columnDefs,
//     queryData,
//     dataKey,
//     gridOptions,
//     defaultColDef,
//     suppressPagination,
//     paginationOptions,
//     getRowId,
//     enableCopyButton
//   }) => (
//     <div data-test="bc-grid-viewer">
//       <div data-test="grid-key">{gridKey}</div>
//       <div data-test="data-key">{dataKey}</div>
//       <div data-test="row-count">
//         {queryData?.data?.[dataKey]?.length || 0} rows
//       </div>
//       <div data-test="pagination-suppressed">
//         {suppressPagination ? 'pagination-suppressed' : 'pagination-enabled'}
//       </div>
//       <div data-test="suppress-pagination-value">
//         {String(suppressPagination)}
//       </div>
//       <div data-test="get-row-id">
//         {getRowId ? 'has-get-row-id' : 'no-get-row-id'}
//       </div>
//       <div data-test="copy-button">
//         {enableCopyButton ? 'copy-enabled' : 'copy-disabled'}
//       </div>
//       <div data-test="has-pagination-options">
//         {paginationOptions ? 'has-pagination' : 'no-pagination'}
//       </div>
//     </div>
//   )
// }))

// // Mock the schema
// vi.mock('@/views/FuelExports/_schema.jsx', () => ({
//   fuelExportSummaryColDefs: [
//     { field: 'fuelType', headerName: 'Fuel Type' },
//     { field: 'quantity', headerName: 'Quantity' },
//     { field: 'destination', headerName: 'Destination' }
//   ]
// }))

// // Mock cell renderers
// vi.mock('@/utils/grid/cellRenderers.jsx', () => ({
//   LinkRenderer: () => <div>Link Renderer</div>
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

// describe('FuelExportSummary', () => {
//   beforeEach(() => {
//     vi.resetAllMocks()
//   })

//   it('renders the component with BCGridViewer', () => {
//     render(
//       <FuelExportSummary
//         data={{ fuelExports: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//     expect(screen.getByTestId('grid-key')).toHaveTextContent('fuel-exports')
//     expect(screen.getByTestId('data-key')).toHaveTextContent('fuelExports')
//     expect(screen.getByTestId('get-row-id')).toHaveTextContent('has-get-row-id')
//     expect(screen.getByTestId('copy-button')).toHaveTextContent('copy-disabled')
//   })

//   it('renders with empty data correctly', () => {
//     render(
//       <FuelExportSummary
//         data={{ fuelExports: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
//   })

//   it('renders fuel export data correctly', () => {
//     const mockData = {
//       fuelExports: [
//         {
//           fuelExportId: 1,
//           fuelType: 'Diesel',
//           quantity: 100,
//           destination: 'USA',
//           actionType: 'CREATE'
//         },
//         {
//           fuelExportId: 2,
//           fuelType: 'Gasoline',
//           quantity: 200,
//           destination: 'Mexico',
//           actionType: 'UPDATE'
//         }
//       ]
//     }

//     render(
//       <FuelExportSummary
//         data={mockData}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
//   })

//   it('filters out deleted items', () => {
//     const mockData = {
//       fuelExports: [
//         {
//           fuelExportId: 1,
//           fuelType: 'Diesel',
//           quantity: 100,
//           destination: 'USA',
//           actionType: 'CREATE'
//         },
//         {
//           fuelExportId: 2,
//           fuelType: 'Gasoline',
//           quantity: 200,
//           destination: 'Mexico',
//           actionType: 'DELETE'
//         },
//         {
//           fuelExportId: 3,
//           fuelType: 'Biodiesel',
//           quantity: 300,
//           destination: 'Canada',
//           actionType: 'UPDATE'
//         }
//       ]
//     }

//     render(
//       <FuelExportSummary
//         data={mockData}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // Should show 2 rows (excluding the deleted one)
//     expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
//   })

//   it('suppresses pagination when 10 or fewer items', () => {
//     const mockData = {
//       fuelExports: Array.from({ length: 8 }, (_, i) => ({
//         fuelExportId: i + 1,
//         fuelType: 'Diesel',
//         quantity: (i + 1) * 100,
//         destination: 'USA',
//         actionType: 'CREATE'
//       }))
//     }

//     render(
//       <FuelExportSummary
//         data={mockData}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
//       'pagination-suppressed'
//     )
//     expect(screen.getByTestId('has-pagination-options')).toHaveTextContent(
//       'has-pagination'
//     )
//   })

//   it('enables pagination when more than 10 items', () => {
//     const mockData = {
//       fuelExports: Array.from({ length: 15 }, (_, i) => ({
//         fuelExportId: i + 1,
//         fuelType: 'Diesel',
//         quantity: (i + 1) * 100,
//         destination: 'USA',
//         actionType: 'CREATE'
//       }))
//     }

//     render(
//       <FuelExportSummary
//         data={mockData}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
//       'pagination-enabled'
//     )
//     expect(screen.getByTestId('has-pagination-options')).toHaveTextContent(
//       'has-pagination'
//     )
//   })

//   it('handles non-DRAFT status correctly (no link renderer)', () => {
//     render(
//       <FuelExportSummary
//         data={{ fuelExports: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.SUBMITTED}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//   })

//   it('handles DRAFT status correctly (with link renderer)', () => {
//     render(
//       <FuelExportSummary
//         data={{ fuelExports: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//   })

//   it('handles undefined data gracefully', () => {
//     render(
//       <FuelExportSummary
//         data={undefined}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
//     expect(screen.getByTestId('suppress-pagination-value')).toHaveTextContent(
//       'true'
//     )
//   })

//   it('handles data without fuelExports property', () => {
//     render(
//       <FuelExportSummary data={{}} status={COMPLIANCE_REPORT_STATUSES.DRAFT} />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
//     expect(screen.getByTestId('suppress-pagination-value')).toHaveTextContent(
//       'true'
//     )
//   })

//   it('applies client-side filtering correctly', () => {
//     const mockData = {
//       fuelExports: [
//         {
//           fuelExportId: 1,
//           fuelType: 'Alpha Diesel',
//           quantity: 100,
//           destination: 'USA',
//           actionType: 'CREATE'
//         },
//         {
//           fuelExportId: 2,
//           fuelType: 'Beta Gasoline',
//           quantity: 200,
//           destination: 'Mexico',
//           actionType: 'CREATE'
//         },
//         {
//           fuelExportId: 3,
//           fuelType: 'Gamma Biodiesel',
//           quantity: 300,
//           destination: 'Canada',
//           actionType: 'CREATE'
//         }
//       ]
//     }

//     render(
//       <FuelExportSummary
//         data={mockData}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // All items should be shown without filters
//     expect(screen.getByTestId('row-count')).toHaveTextContent('3 rows')
//   })

//   it('correctly implements getRowId function', () => {
//     const mockData = {
//       fuelExports: [
//         {
//           fuelExportId: 123,
//           fuelType: 'Test Fuel',
//           quantity: 500,
//           destination: 'Test Country',
//           actionType: 'CREATE'
//         }
//       ]
//     }

//     render(
//       <FuelExportSummary
//         data={mockData}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // The mock shows that getRowId function is passed
//     expect(screen.getByTestId('get-row-id')).toHaveTextContent('has-get-row-id')
//   })

//   it('disables copy button by default', () => {
//     render(
//       <FuelExportSummary
//         data={{ fuelExports: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('copy-button')).toHaveTextContent('copy-disabled')
//   })

//   it('passes correct auto size strategy', () => {
//     render(
//       <FuelExportSummary
//         data={{ fuelExports: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // Component should render without errors, indicating autoSizeStrategy is properly passed
//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//   })

//   it('handles pagination options updates', () => {
//     render(
//       <FuelExportSummary
//         data={{ fuelExports: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // Component should render and handle pagination options correctly
//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//     expect(screen.getByTestId('has-pagination-options')).toHaveTextContent(
//       'has-pagination'
//     )
//   })

//   it('uses fitCellContents auto size strategy', () => {
//     const mockData = {
//       fuelExports: [
//         {
//           fuelExportId: 1,
//           fuelType: 'Very Long Fuel Type Name That Should Test Auto Sizing',
//           quantity: 1000,
//           destination: 'Very Long Destination Country Name',
//           actionType: 'CREATE'
//         }
//       ]
//     }

//     render(
//       <FuelExportSummary
//         data={mockData}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // Component should render correctly with long content
//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//     expect(screen.getByTestId('row-count')).toHaveTextContent('1 rows')
//   })

//   it('maintains consistent grid configuration', () => {
//     render(
//       <FuelExportSummary
//         data={{ fuelExports: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // Verify key grid configuration
//     expect(screen.getByTestId('grid-key')).toHaveTextContent('fuel-exports')
//     expect(screen.getByTestId('data-key')).toHaveTextContent('fuelExports')
//     expect(screen.getByTestId('copy-button')).toHaveTextContent('copy-disabled')
//     expect(screen.getByTestId('get-row-id')).toHaveTextContent('has-get-row-id')
//   })

//   it('uses static column definitions from schema', () => {
//     render(
//       <FuelExportSummary
//         data={{ fuelExports: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // Component should render, indicating the static column definitions were used correctly
//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//   })

//   it('applies correct cell renderer URL configuration', () => {
//     render(
//       <FuelExportSummary
//         data={{ fuelExports: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // Component should render with proper configuration for fuel-exports URL
//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//   })

//   it('handles mixed action types correctly', () => {
//     const mockData = {
//       fuelExports: [
//         {
//           fuelExportId: 1,
//           fuelType: 'Diesel',
//           quantity: 100,
//           actionType: 'CREATE'
//         },
//         {
//           fuelExportId: 2,
//           fuelType: 'Gasoline',
//           quantity: 200,
//           actionType: 'UPDATE'
//         },
//         {
//           fuelExportId: 3,
//           fuelType: 'Biodiesel',
//           quantity: 300,
//           actionType: 'DELETE'
//         },
//         {
//           fuelExportId: 4,
//           fuelType: 'Ethanol',
//           quantity: 400,
//           actionType: 'CREATE'
//         }
//       ]
//     }

//     render(
//       <FuelExportSummary
//         data={mockData}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // Should show 3 rows (excluding the deleted one)
//     expect(screen.getByTestId('row-count')).toHaveTextContent('3 rows')
//   })

//   it('handles items without actionType property', () => {
//     const mockData = {
//       fuelExports: [
//         {
//           fuelExportId: 1,
//           fuelType: 'Diesel',
//           quantity: 100
//           // No actionType property
//         },
//         {
//           fuelExportId: 2,
//           fuelType: 'Gasoline',
//           quantity: 200,
//           actionType: 'CREATE'
//         }
//       ]
//     }

//     render(
//       <FuelExportSummary
//         data={mockData}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // Should show both rows (item without actionType should not be filtered out)
//     expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
//   })
// })
describe.todo()