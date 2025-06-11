// import React from 'react'
// import { render, screen } from '@testing-library/react'
// import { describe, it, expect, beforeEach, vi } from 'vitest'
// import { OtherUsesSummary } from '../OtherUsesSummary'
// import { wrapper } from '@/tests/utils/wrapper'
// import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

// // Mock BCGridViewer
// vi.mock('@/components/BCDataGrid/BCGridViewer.jsx', () => ({
//   BCGridViewer: ({
//     gridKey,
//     columnDefs,
//     queryData,
//     dataKey,
//     defaultColDef,
//     suppressPagination,
//     paginationOptions,
//     getRowId,
//     autoSizeStrategy,
//     enableCellTextSelection
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
//       <div data-test="has-pagination-options">
//         {paginationOptions ? 'has-pagination' : 'no-pagination'}
//       </div>
//       <div data-test="auto-size-strategy">
//         {autoSizeStrategy ? 'has-auto-size' : 'no-auto-size'}
//       </div>
//       <div data-test="cell-text-selection">
//         {enableCellTextSelection
//           ? 'text-selection-enabled'
//           : 'text-selection-disabled'}
//       </div>
//     </div>
//   )
// }))

// // Mock the schema
// vi.mock('@/views/OtherUses/_schema.jsx', () => ({
//   otherUsesSummaryColDefs: [
//     { field: 'fuelType', headerName: 'Fuel Type' },
//     { field: 'quantitySupplied', headerName: 'Quantity Supplied' },
//     { field: 'units', headerName: 'Units' }
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

// describe('OtherUsesSummary', () => {
//   beforeEach(() => {
//     vi.resetAllMocks()
//   })

//   it('renders the component with BCGridViewer', () => {
//     render(
//       <OtherUsesSummary
//         data={{ otherUses: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//     expect(screen.getByTestId('grid-key')).toHaveTextContent('other-uses')
//     expect(screen.getByTestId('data-key')).toHaveTextContent('otherUses')
//     expect(screen.getByTestId('get-row-id')).toHaveTextContent('has-get-row-id')
//     expect(screen.getByTestId('container')).toBeInTheDocument()
//   })

//   it('renders with empty data correctly', () => {
//     render(
//       <OtherUsesSummary
//         data={{ otherUses: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
//   })

//   it('renders other uses data correctly', () => {
//     const mockData = {
//       otherUses: [
//         {
//           otherUsesId: 1,
//           fuelType: 'Diesel',
//           quantitySupplied: 100,
//           units: 'L',
//           actionType: 'CREATE'
//         },
//         {
//           otherUsesId: 2,
//           fuelType: 'Gasoline',
//           quantitySupplied: 200,
//           units: 'L',
//           actionType: 'UPDATE'
//         }
//       ]
//     }

//     render(
//       <OtherUsesSummary
//         data={mockData}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
//   })

//   it('filters out deleted items', () => {
//     const mockData = {
//       otherUses: [
//         {
//           otherUsesId: 1,
//           fuelType: 'Diesel',
//           quantitySupplied: 100,
//           actionType: 'CREATE'
//         },
//         {
//           otherUsesId: 2,
//           fuelType: 'Gasoline',
//           quantitySupplied: 200,
//           actionType: 'DELETE'
//         },
//         {
//           otherUsesId: 3,
//           fuelType: 'Biodiesel',
//           quantitySupplied: 300,
//           actionType: 'UPDATE'
//         }
//       ]
//     }

//     render(
//       <OtherUsesSummary
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
//       otherUses: Array.from({ length: 8 }, (_, i) => ({
//         otherUsesId: i + 1,
//         fuelType: 'Diesel',
//         quantitySupplied: (i + 1) * 100,
//         units: 'L',
//         actionType: 'CREATE'
//       }))
//     }

//     render(
//       <OtherUsesSummary
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
//       otherUses: Array.from({ length: 15 }, (_, i) => ({
//         otherUsesId: i + 1,
//         fuelType: 'Diesel',
//         quantitySupplied: (i + 1) * 100,
//         units: 'L',
//         actionType: 'CREATE'
//       }))
//     }

//     render(
//       <OtherUsesSummary
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
//       <OtherUsesSummary
//         data={{ otherUses: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.SUBMITTED}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//   })

//   it('handles DRAFT status correctly (with link renderer)', () => {
//     render(
//       <OtherUsesSummary
//         data={{ otherUses: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//   })

//   it('handles undefined data gracefully', () => {
//     render(
//       <OtherUsesSummary
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

//   it('handles data without otherUses property', () => {
//     render(
//       <OtherUsesSummary data={{}} status={COMPLIANCE_REPORT_STATUSES.DRAFT} />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
//     expect(screen.getByTestId('suppress-pagination-value')).toHaveTextContent(
//       'true'
//     )
//   })

//   it('applies client-side filtering correctly', () => {
//     const mockData = {
//       otherUses: [
//         {
//           otherUsesId: 1,
//           fuelType: 'Alpha Diesel',
//           quantitySupplied: 100,
//           actionType: 'CREATE'
//         },
//         {
//           otherUsesId: 2,
//           fuelType: 'Beta Gasoline',
//           quantitySupplied: 200,
//           actionType: 'CREATE'
//         },
//         {
//           otherUsesId: 3,
//           fuelType: 'Gamma Biodiesel',
//           quantitySupplied: 300,
//           actionType: 'CREATE'
//         }
//       ]
//     }

//     render(
//       <OtherUsesSummary
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
//       otherUses: [
//         {
//           otherUsesId: 123,
//           fuelType: 'Test Fuel',
//           quantitySupplied: 500,
//           actionType: 'CREATE'
//         }
//       ]
//     }

//     render(
//       <OtherUsesSummary
//         data={mockData}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // The mock shows that getRowId function is passed
//     expect(screen.getByTestId('get-row-id')).toHaveTextContent('has-get-row-id')
//   })

//   it('uses fitCellContents auto size strategy', () => {
//     render(
//       <OtherUsesSummary
//         data={{ otherUses: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('auto-size-strategy')).toHaveTextContent(
//       'has-auto-size'
//     )
//   })

//   it('enables cell text selection', () => {
//     render(
//       <OtherUsesSummary
//         data={{ otherUses: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('cell-text-selection')).toHaveTextContent(
//       'text-selection-enabled'
//     )
//   })

//   it('handles pagination options updates', () => {
//     render(
//       <OtherUsesSummary
//         data={{ otherUses: [] }}
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

//   it('uses correct cell renderer URL configuration', () => {
//     render(
//       <OtherUsesSummary
//         data={{ otherUses: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // Component should render with proper configuration for fuels-other-use URL
//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//   })

//   it('maintains consistent grid configuration', () => {
//     render(
//       <OtherUsesSummary
//         data={{ otherUses: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // Verify key grid configuration
//     expect(screen.getByTestId('grid-key')).toHaveTextContent('other-uses')
//     expect(screen.getByTestId('data-key')).toHaveTextContent('otherUses')
//     expect(screen.getByTestId('get-row-id')).toHaveTextContent('has-get-row-id')
//     expect(screen.getByTestId('auto-size-strategy')).toHaveTextContent(
//       'has-auto-size'
//     )
//     expect(screen.getByTestId('cell-text-selection')).toHaveTextContent(
//       'text-selection-enabled'
//     )
//   })

//   it('handles long content with auto sizing', () => {
//     const mockData = {
//       otherUses: [
//         {
//           otherUsesId: 1,
//           fuelType:
//             'Very Long Fuel Type Name That Should Test Auto Sizing Functionality',
//           quantitySupplied: 1000,
//           units: 'Liters',
//           actionType: 'CREATE'
//         }
//       ]
//     }

//     render(
//       <OtherUsesSummary
//         data={mockData}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // Component should render correctly with long content
//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//     expect(screen.getByTestId('row-count')).toHaveTextContent('1 rows')
//     expect(screen.getByTestId('auto-size-strategy')).toHaveTextContent(
//       'has-auto-size'
//     )
//   })

//   it('uses static column definitions from schema', () => {
//     render(
//       <OtherUsesSummary
//         data={{ otherUses: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // Component should render, indicating the static column definitions were used correctly
//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//   })

//   it('handles mixed action types correctly', () => {
//     const mockData = {
//       otherUses: [
//         {
//           otherUsesId: 1,
//           fuelType: 'Diesel',
//           quantitySupplied: 100,
//           actionType: 'CREATE'
//         },
//         {
//           otherUsesId: 2,
//           fuelType: 'Gasoline',
//           quantitySupplied: 200,
//           actionType: 'UPDATE'
//         },
//         {
//           otherUsesId: 3,
//           fuelType: 'Biodiesel',
//           quantitySupplied: 300,
//           actionType: 'DELETE'
//         },
//         {
//           otherUsesId: 4,
//           fuelType: 'Ethanol',
//           quantitySupplied: 400,
//           actionType: 'CREATE'
//         }
//       ]
//     }

//     render(
//       <OtherUsesSummary
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
//       otherUses: [
//         {
//           otherUsesId: 1,
//           fuelType: 'Diesel',
//           quantitySupplied: 100
//           // No actionType property
//         },
//         {
//           otherUsesId: 2,
//           fuelType: 'Gasoline',
//           quantitySupplied: 200,
//           actionType: 'CREATE'
//         }
//       ]
//     }

//     render(
//       <OtherUsesSummary
//         data={mockData}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // Should show both rows (item without actionType should not be filtered out)
//     expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
//   })

//   it('handles empty array after filtering', () => {
//     const mockData = {
//       otherUses: [
//         {
//           otherUsesId: 1,
//           fuelType: 'Diesel',
//           quantitySupplied: 100,
//           actionType: 'DELETE'
//         },
//         {
//           otherUsesId: 2,
//           fuelType: 'Gasoline',
//           quantitySupplied: 200,
//           actionType: 'DELETE'
//         }
//       ]
//     }

//     render(
//       <OtherUsesSummary
//         data={mockData}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // Should show 0 rows (all items deleted)
//     expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
//     expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
//       'pagination-suppressed'
//     )
//   })

//   it('calculates pagination suppression correctly with null data', () => {
//     render(
//       <OtherUsesSummary
//         data={{ otherUses: null }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('suppress-pagination-value')).toHaveTextContent(
//       'true'
//     )
//   })
// })
describe.todo()