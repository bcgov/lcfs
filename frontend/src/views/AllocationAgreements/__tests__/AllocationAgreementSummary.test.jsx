// import React from 'react'
// import { render, screen } from '@testing-library/react'
// import { describe, it, expect, beforeEach, vi } from 'vitest'
// import { AllocationAgreementSummary } from '../AllocationAgreementSummary'
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
// vi.mock('./_schema', () => ({
//   allocAgrmtSummaryColDefs: (t) => [
//     { field: 'agreementName', headerName: 'Agreement Name' },
//     { field: 'fuel', headerName: 'Fuel' },
//     { field: 'quantity', headerName: 'Quantity' }
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

// describe('AllocationAgreementSummary', () => {
//   beforeEach(() => {
//     vi.resetAllMocks()
//   })

//   it('renders the component with BCGridViewer', () => {
//     render(
//       <AllocationAgreementSummary
//         data={{ allocationAgreements: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//     expect(screen.getByTestId('grid-key')).toHaveTextContent(
//       'allocation-agreements'
//     )
//     expect(screen.getByTestId('data-key')).toHaveTextContent(
//       'allocationAgreements'
//     )
//     expect(screen.getByTestId('get-row-id')).toHaveTextContent('has-get-row-id')
//     expect(screen.getByTestId('copy-button')).toHaveTextContent('copy-disabled')
//   })

//   it('renders with empty data correctly', () => {
//     render(
//       <AllocationAgreementSummary
//         data={{ allocationAgreements: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
//   })

//   it('renders allocation agreement data correctly', () => {
//     const mockData = {
//       allocationAgreements: [
//         {
//           allocationAgreementId: 1,
//           agreementName: 'Agreement A',
//           fuel: 'Diesel',
//           quantity: 100,
//           actionType: 'CREATE'
//         },
//         {
//           allocationAgreementId: 2,
//           agreementName: 'Agreement B',
//           fuel: 'Gasoline',
//           quantity: 200,
//           actionType: 'UPDATE'
//         }
//       ]
//     }

//     render(
//       <AllocationAgreementSummary
//         data={mockData}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
//   })

//   it('filters out deleted items', () => {
//     const mockData = {
//       allocationAgreements: [
//         {
//           allocationAgreementId: 1,
//           agreementName: 'Agreement A',
//           fuel: 'Diesel',
//           actionType: 'CREATE'
//         },
//         {
//           allocationAgreementId: 2,
//           agreementName: 'Agreement B',
//           fuel: 'Gasoline',
//           actionType: 'DELETE'
//         },
//         {
//           allocationAgreementId: 3,
//           agreementName: 'Agreement C',
//           fuel: 'Biodiesel',
//           actionType: 'UPDATE'
//         }
//       ]
//     }

//     render(
//       <AllocationAgreementSummary
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
//       allocationAgreements: Array.from({ length: 8 }, (_, i) => ({
//         allocationAgreementId: i + 1,
//         agreementName: `Agreement${i + 1}`,
//         fuel: 'Diesel',
//         quantity: (i + 1) * 100,
//         actionType: 'CREATE'
//       }))
//     }

//     render(
//       <AllocationAgreementSummary
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
//       allocationAgreements: Array.from({ length: 15 }, (_, i) => ({
//         allocationAgreementId: i + 1,
//         agreementName: `Agreement${i + 1}`,
//         fuel: 'Diesel',
//         quantity: (i + 1) * 100,
//         actionType: 'CREATE'
//       }))
//     }

//     render(
//       <AllocationAgreementSummary
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
//       <AllocationAgreementSummary
//         data={{ allocationAgreements: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.SUBMITTED}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//   })

//   it('handles data without allocationAgreements property', () => {
//     render(
//       <AllocationAgreementSummary
//         data={{}}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
//     expect(screen.getByTestId('suppress-pagination-value')).toHaveTextContent(
//       'true'
//     )
//   })

//   it('applies client-side filtering correctly', () => {
//     const mockData = {
//       allocationAgreements: [
//         {
//           allocationAgreementId: 1,
//           agreementName: 'Alpha Agreement',
//           fuel: 'Diesel',
//           actionType: 'CREATE'
//         },
//         {
//           allocationAgreementId: 2,
//           agreementName: 'Beta Agreement',
//           fuel: 'Gasoline',
//           actionType: 'CREATE'
//         },
//         {
//           allocationAgreementId: 3,
//           agreementName: 'Gamma Agreement',
//           fuel: 'Biodiesel',
//           actionType: 'CREATE'
//         }
//       ]
//     }

//     render(
//       <AllocationAgreementSummary
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
//       allocationAgreements: [
//         {
//           allocationAgreementId: 123,
//           agreementName: 'Test Agreement',
//           fuel: 'Diesel',
//           actionType: 'CREATE'
//         }
//       ]
//     }

//     render(
//       <AllocationAgreementSummary
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
//       <AllocationAgreementSummary
//         data={{ allocationAgreements: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     expect(screen.getByTestId('copy-button')).toHaveTextContent('copy-disabled')
//   })

//   it('passes correct auto size strategy', () => {
//     render(
//       <AllocationAgreementSummary
//         data={{ allocationAgreements: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // Component should render without errors, indicating autoSizeStrategy is properly passed
//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//   })

//   it('handles pagination options updates', () => {
//     render(
//       <AllocationAgreementSummary
//         data={{ allocationAgreements: [] }}
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
//       allocationAgreements: [
//         {
//           allocationAgreementId: 1,
//           agreementName:
//             'Very Long Agreement Name That Should Test Auto Sizing',
//           fuel: 'Diesel',
//           quantity: 1000,
//           actionType: 'CREATE'
//         }
//       ]
//     }

//     render(
//       <AllocationAgreementSummary
//         data={mockData}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // Component should render correctly with long content
//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//     expect(screen.getByTestId('row-count')).toHaveTextContent('1 rows')
//   })

//   it('passes translation function to column definitions', () => {
//     render(
//       <AllocationAgreementSummary
//         data={{ allocationAgreements: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // Component should render, indicating the t function was passed correctly to schema
//     expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
//   })

//   it('maintains consistent grid configuration', () => {
//     render(
//       <AllocationAgreementSummary
//         data={{ allocationAgreements: [] }}
//         status={COMPLIANCE_REPORT_STATUSES.DRAFT}
//       />,
//       { wrapper }
//     )

//     // Verify key grid configuration
//     expect(screen.getByTestId('grid-key')).toHaveTextContent(
//       'allocation-agreements'
//     )
//     expect(screen.getByTestId('data-key')).toHaveTextContent(
//       'allocationAgreements'
//     )
//     expect(screen.getByTestId('copy-button')).toHaveTextContent('copy-disabled')
//     expect(screen.getByTestId('get-row-id')).toHaveTextContent('has-get-row-id')
//   })
// })
describe.todo()