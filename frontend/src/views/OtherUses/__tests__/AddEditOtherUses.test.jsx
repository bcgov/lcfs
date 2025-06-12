// import { useComplianceReportWithCache } from '@/hooks/useComplianceReports'
// import {
//   useGetAllOtherUsesList,
//   useOtherUsesOptions,
//   useSaveOtherUses
// } from '@/hooks/useOtherUses'
// import { wrapper } from '@/tests/utils/wrapper'
// import { render, screen, waitFor, fireEvent } from '@testing-library/react'
// import { beforeEach, describe, expect, it, vi } from 'vitest'
// import { AddEditOtherUses } from '../AddEditOtherUses'

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
// vi.mock('@/hooks/useOtherUses')

// // Mock BCGridEditor
// vi.mock('@/components/BCDataGrid/BCGridEditor', () => ({
//   BCGridEditor: ({
//     gridRef,
//     alertRef,
//     onGridReady,
//     rowData,
//     onCellValueChanged,
//     onCellEditingStopped,
//     onAction,
//     loading,
//     getRowId
//   }) => {
//     // Set up the alertRef mock when the component mounts
//     if (alertRef && alertRef.current === null) {
//       alertRef.current = {
//         triggerAlert: vi.fn()
//       }
//     }

//     return (
//       <div data-test="bc-grid-editor">
//         <div data-test="loading">{loading ? 'loading' : 'not-loading'}</div>
//         <div data-test="row-data">
//           {rowData.map((row, index) => (
//             <div key={index} data-test="grid-row">
//               {row.id} - {row.fuelType || 'empty'}
//             </div>
//           ))}
//         </div>
//         <button
//           data-test="trigger-grid-ready"
//           onClick={() => {
//             const mockParams = {
//               api: {
//                 sizeColumnsToFit: vi.fn(),
//                 getLastDisplayedRowIndex: () => 0,
//                 startEditingCell: vi.fn()
//               }
//             }
//             onGridReady?.(mockParams)
//           }}
//         >
//           Trigger Grid Ready
//         </button>
//         <button
//           data-test="trigger-cell-value-changed"
//           onClick={() => {
//             const mockParams = {
//               colDef: { field: 'fuelType' },
//               data: { fuelType: 'Diesel' },
//               node: {
//                 setDataValue: vi.fn()
//               }
//             }
//             onCellValueChanged?.(mockParams)
//           }}
//         >
//           Trigger Cell Value Changed
//         </button>
//         <button
//           data-test="trigger-cell-editing-stopped"
//           onClick={() => {
//             const mockParams = {
//               oldValue: 'old',
//               newValue: 'new',
//               colDef: { field: 'quantitySupplied' },
//               node: {
//                 data: { quantitySupplied: 100 },
//                 updateData: vi.fn()
//               },
//               data: { quantitySupplied: 100 }
//             }
//             onCellEditingStopped?.(mockParams)
//           }}
//         >
//           Trigger Cell Editing Stopped
//         </button>
//         <div data-test="get-row-id">
//           {getRowId ? 'has-get-row-id' : 'no-get-row-id'}
//         </div>
//       </div>
//     )
//   }
// }))

// // Mock Loading component
// vi.mock('@/components/Loading', () => ({
//   default: () => <div data-test="loading-component">Loading...</div>
// }))

// // Mock schema
// vi.mock('./_schema', () => ({
//   defaultColDef: {},
//   otherUsesColDefs: (optionsData, errors, warnings, isSupplemental) => [
//     { field: 'fuelType', headerName: 'Fuel Type' },
//     { field: 'quantitySupplied', headerName: 'Quantity Supplied' }
//   ],
//   PROVISION_APPROVED_FUEL_CODE: 'APPROVED_FUEL_CODE'
// }))

// // Mock utility functions
// vi.mock('@/utils/schedules.js', () => ({
//   handleScheduleDelete: vi.fn(),
//   handleScheduleSave: vi.fn().mockResolvedValue({ saved: true })
// }))

// vi.mock('@/utils/formatters', () => ({
//   cleanEmptyStringValues: vi.fn((data) => data),
//   formatNumberWithCommas: vi.fn((num) => num?.toString() || ''),
//   decimalFormatter: vi.fn((value, decimals = 2) =>
//     value ? parseFloat(value).toFixed(decimals) : ''
//   )
// }))

// describe('AddEditOtherUses', () => {
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
//           version: 0
//         }
//       },
//       isLoading: false
//     })

//     // Mock useOtherUsesOptions
//     vi.mocked(useOtherUsesOptions).mockReturnValue({
//       data: {
//         fuelTypes: [
//           {
//             fuelType: 'Diesel',
//             units: 'L',
//             fuelCategories: [{ category: 'Petroleum' }],
//             provisionOfTheAct: [{ name: 'Part 2' }],
//             defaultCarbonIntensity: 85.5,
//             fuelCodes: [
//               {
//                 fuelCode: 'FC001',
//                 fuelCodeId: 1,
//                 carbonIntensity: 75.0
//               }
//             ]
//           },
//           {
//             fuelType: 'Gasoline',
//             units: 'L',
//             fuelCategories: [
//               { category: 'Petroleum' },
//               { category: 'Renewable' }
//             ],
//             provisionOfTheAct: [
//               { name: 'Part 2' },
//               { name: 'APPROVED_FUEL_CODE' }
//             ],
//             defaultCarbonIntensity: 88.2,
//             fuelCodes: [
//               {
//                 fuelCode: 'FC002',
//                 fuelCodeId: 2,
//                 carbonIntensity: 70.5
//               }
//             ]
//           }
//         ],
//         expectedUses: [
//           { id: 1, name: 'Transportation', description: 'Vehicle fuel' },
//           { id: 2, name: 'Heating', description: 'Building heating' },
//           { id: 3, name: 'Industrial', description: 'Industrial processes' }
//         ]
//       },
//       isLoading: false,
//       isFetched: true
//     })

//     // Mock useGetAllOtherUsesList
//     vi.mocked(useGetAllOtherUsesList).mockReturnValue({
//       data: [],
//       isLoading: false
//     })

//     // Mock useSaveOtherUses
//     vi.mocked(useSaveOtherUses).mockReturnValue({
//       mutateAsync: vi.fn()
//     })
//   })

//   it('shows loading component when options are loading', () => {
//     vi.mocked(useOtherUsesOptions).mockReturnValue({
//       data: null,
//       isLoading: true,
//       isFetched: false
//     })

//     render(<AddEditOtherUses />, { wrapper })
//     expect(screen.getByTestId('loading-component')).toBeInTheDocument()
//   })

//   it('shows loading component when other uses data is loading', () => {
//     vi.mocked(useGetAllOtherUsesList).mockReturnValue({
//       data: null,
//       isLoading: true
//     })

//     render(<AddEditOtherUses />, { wrapper })
//     expect(screen.getByTestId('loading-component')).toBeInTheDocument()
//   })

//   it('shows loading component when compliance report is loading', () => {
//     vi.mocked(useComplianceReportWithCache).mockReturnValue({
//       data: null,
//       isLoading: true
//     })

//     render(<AddEditOtherUses />, { wrapper })
//     expect(screen.getByTestId('loading-component')).toBeInTheDocument()
//   })

//   it('renders the component when data is loaded', () => {
//     render(<AddEditOtherUses />, { wrapper })

//     expect(screen.getByText('otherUses:newOtherUsesTitle')).toBeInTheDocument()
//     expect(screen.getByText('otherUses:newOtherUsesGuide')).toBeInTheDocument()
//     expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
//   })

//   it('initializes with one empty row when no existing other uses', () => {
//     render(<AddEditOtherUses />, { wrapper })

//     const rows = screen.getAllByTestId('grid-row')
//     expect(rows.length).toBe(1)
//     expect(rows[0]).toHaveTextContent('empty')
//   })

//   it('loads existing other uses when available', () => {
//     vi.mocked(useGetAllOtherUsesList).mockReturnValue({
//       data: [
//         { otherUsesId: 1, fuelType: 'Diesel', quantitySupplied: 100 },
//         { otherUsesId: 2, fuelType: 'Gasoline', quantitySupplied: 200 }
//       ],
//       isLoading: false
//     })

//     render(<AddEditOtherUses />, { wrapper })

//     const rows = screen.getAllByTestId('grid-row')
//     // Should have 2 existing rows + 1 empty row
//     expect(rows.length).toBe(3)
//     expect(rows[0]).toHaveTextContent('Diesel')
//     expect(rows[1]).toHaveTextContent('Gasoline')
//     expect(rows[2]).toHaveTextContent('empty')
//   })

//   it('handles supplemental report correctly', () => {
//     vi.mocked(useComplianceReportWithCache).mockReturnValue({
//       data: {
//         report: {
//           version: 1 // Supplemental report
//         }
//       },
//       isLoading: false
//     })

//     render(<AddEditOtherUses />, { wrapper })
//     expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
//   })

//   it('displays alert message from location state', async () => {
//     mockUseLocation.mockReturnValue({
//       pathname: '/test-path',
//       state: { message: 'Test Alert', severity: 'error' }
//     })

//     render(<AddEditOtherUses />, { wrapper })

//     // Component should render without errors when location state has message
//     expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
//   })

//   it('handles grid ready callback', async () => {
//     render(<AddEditOtherUses />, { wrapper })

//     const triggerButton = screen.getByTestId('trigger-grid-ready')
//     fireEvent.click(triggerButton)

//     await waitFor(() => {
//       expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
//     })
//   })

//   it('handles cell value changed callback', async () => {
//     render(<AddEditOtherUses />, { wrapper })

//     const triggerButton = screen.getByTestId('trigger-cell-value-changed')
//     fireEvent.click(triggerButton)

//     await waitFor(() => {
//       expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
//     })
//   })

//   it('handles cell editing stopped callback', async () => {
//     render(<AddEditOtherUses />, { wrapper })

//     const triggerButton = screen.getByTestId('trigger-cell-editing-stopped')
//     fireEvent.click(triggerButton)

//     await waitFor(() => {
//       expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
//     })
//   })

//   it('sets correct row data structure for new entries', () => {
//     render(<AddEditOtherUses />, { wrapper })

//     const rows = screen.getAllByTestId('grid-row')
//     expect(rows.length).toBe(1)
//     // Should have an ID (UUID) assigned
//     expect(rows[0].textContent).toMatch(/^[a-f0-9-]+ - empty$/)
//   })

//   it('sets correct row data structure for existing entries', () => {
//     vi.mocked(useGetAllOtherUsesList).mockReturnValue({
//       data: [
//         {
//           otherUsesId: 1,
//           fuelType: 'Test Fuel',
//           complianceReportId: 'testReportId'
//         }
//       ],
//       isLoading: false
//     })

//     render(<AddEditOtherUses />, { wrapper })

//     const rows = screen.getAllByTestId('grid-row')
//     expect(rows.length).toBe(2) // 1 existing + 1 empty
//     expect(rows[0]).toHaveTextContent('Test Fuel')
//   })

//   it('handles empty other uses data', () => {
//     vi.mocked(useGetAllOtherUsesList).mockReturnValue({
//       data: null,
//       isLoading: false
//     })

//     render(<AddEditOtherUses />, { wrapper })

//     const rows = screen.getAllByTestId('grid-row')
//     expect(rows.length).toBe(1)
//     expect(rows[0]).toHaveTextContent('empty')
//   })

//   it('does not render when not fetched', () => {
//     vi.mocked(useOtherUsesOptions).mockReturnValue({
//       data: null,
//       isLoading: false,
//       isFetched: false
//     })

//     const { container } = render(<AddEditOtherUses />, { wrapper })
//     expect(container.firstChild).toBeNull()
//   })

//   it('handles error in row data processing', () => {
//     // Mock console.error to avoid test output noise
//     const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

//     // Create invalid data that would cause processing error
//     vi.mocked(useGetAllOtherUsesList).mockReturnValue({
//       data: [{ invalid: 'data' }],
//       isLoading: false
//     })

//     render(<AddEditOtherUses />, { wrapper })

//     // Should still render with fallback empty row
//     const rows = screen.getAllByTestId('grid-row')
//     expect(rows.length).toBe(1)

//     consoleSpy.mockRestore()
//   })

//   it('correctly implements getRowId function', () => {
//     render(<AddEditOtherUses />, { wrapper })

//     // The mock shows that getRowId function is passed
//     expect(screen.getByTestId('get-row-id')).toHaveTextContent('has-get-row-id')
//   })

//   it('handles findCiOfFuel utility function', () => {
//     vi.mocked(useOtherUsesOptions).mockReturnValue({
//       data: {
//         fuelTypes: [
//           {
//             fuelType: 'Diesel',
//             defaultCarbonIntensity: 85.5,
//             fuelCodes: [{ fuelCode: 'FC001', carbonIntensity: 75.0 }]
//           }
//         ]
//       },
//       isLoading: false,
//       isFetched: true
//     })

//     render(<AddEditOtherUses />, { wrapper })

//     // Component should render successfully with fuel types
//     expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
//   })

//   it('processes supplemental entries correctly', () => {
//     vi.mocked(useComplianceReportWithCache).mockReturnValue({
//       data: {
//         report: {
//           version: 1 // Supplemental
//         }
//       },
//       isLoading: false
//     })

//     vi.mocked(useGetAllOtherUsesList).mockReturnValue({
//       data: [
//         {
//           otherUsesId: 1,
//           fuelType: 'Diesel',
//           complianceReportId: 'testReportId' // This should be marked as new supplemental entry
//         }
//       ],
//       isLoading: false
//     })

//     render(<AddEditOtherUses />, { wrapper })

//     const rows = screen.getAllByTestId('grid-row')
//     expect(rows.length).toBe(2) // 1 existing + 1 empty
//   })

//   it('validates quantity supplied correctly', async () => {
//     render(<AddEditOtherUses />, { wrapper })

//     // Test the validation through cell editing stopped
//     const triggerButton = screen.getByTestId('trigger-cell-editing-stopped')
//     fireEvent.click(triggerButton)

//     await waitFor(() => {
//       expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
//     })
//   })

//   it('handles auto-population of fuel type fields', async () => {
//     render(<AddEditOtherUses />, { wrapper })

//     // Test auto-population through cell value changed
//     const triggerButton = screen.getByTestId('trigger-cell-value-changed')
//     fireEvent.click(triggerButton)

//     await waitFor(() => {
//       expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
//     })
//   })

//   it('handles navigation back correctly', () => {
//     render(<AddEditOtherUses />, { wrapper })

//     // Component should render with save button that can navigate back
//     expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
//   })
// })
describe.todo()