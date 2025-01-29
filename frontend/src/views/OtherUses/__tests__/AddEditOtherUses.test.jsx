import { describe } from 'vitest'
// import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
// import { BrowserRouter as Router, useNavigate, useParams, useLocation } from 'react-router-dom'
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// import { ThemeProvider } from '@mui/material'
// import theme from '@/themes'
// import { AddEditOtherUses } from '@/views/OtherUses/AddEditOtherUses'
describe.todo()
// // Mock the necessary hooks and components
// vi.mock('react-router-dom', async () => {
//   const actual = await vi.importActual('react-router-dom')
//   return {
//     ...actual,
//     useNavigate: vi.fn(),
//     useParams: () => ({
//       complianceReportId: '123',
//       compliancePeriod: '2024'
//     }),
//     useLocation: vi.fn()
//   }
// })

// vi.mock('@react-keycloak/web', () => ({
//   useKeycloak: () => ({
//     keycloak: {
//       token: 'mock-token',
//       authenticated: true,
//       initialized: true
//     }
//   })
// }))

// vi.mock('@/hooks/useCurrentUser', () => ({
//   useCurrentUser: () => ({
//     data: {
//       roles: [
//         { name: 'Supplier' },
//         { name: 'Government' }
//       ]
//     }
//   })
// }))

// vi.mock('@/components/BCDataGrid/BCDataGridEditor', () => ({
//   __esModule: true,
//   default: () => <div data-test="mockedBCDataGridEditor"></div>
// }))

// vi.mock('@/hooks/useOtherUses', () => ({
//   useOtherUsesOptions: () => ({
//     data: {
//       fuelTypes: [{ fuelType: 'Diesel' }],
//       fuelCategories: [{ category: 'Biofuel' }],
//       expectedUses: [{ name: 'Transport' }],
//       unitsOfMeasure: [{ name: 'liters' }]
//     },
//     isLoading: false,
//     isFetched: true,
//   }),
//   useGetAllOtherUses: (complianceReportId) => ({
//     data: [{ id: '001', fuelType: 'Diesel', fuelCategory: 'Biofuel', quantitySupplied: 100, units: 'liters', expectedUse: 'Transport' }],
//     isLoading: false,
//   }),
//   useSaveOtherUses: () => ({
//     mutate: vi.fn()
//   })
// }))

// const WrapperComponent = (props) => {
//   const queryClient = new QueryClient()
//   return (
//     <QueryClientProvider client={queryClient}>
//       <ThemeProvider theme={theme}>
//         <Router>
//           <AddEditOtherUses {...props} />
//         </Router>
//       </ThemeProvider>
//     </QueryClientProvider>
//   )
// }

// describe('AddEditOtherUses Component Tests', () => {
//   let navigate
//   let location

//   beforeEach(() => {
//     navigate = vi.fn()
//     location = vi.fn()
//     vi.mocked(useNavigate).mockReturnValue(navigate)
//     vi.mocked(useLocation).mockReturnValue(location)
//   })

//   afterEach(() => {
//     cleanup()
//     vi.resetAllMocks()
//   })

//   test('renders title correctly', () => {
//     render(<WrapperComponent complianceReportId="123" compliancePeriod="2024" />)
//     const title = screen.getByText('New Other Uses')
//     expect(title).toBeInTheDocument()
//   })

//   test('displays alert message if present', () => {
//     const mockLocation = {
//       state: { message: 'Test Alert Message', severity: 'error' }
//     }
//     vi.mocked(useLocation).mockReturnValue(mockLocation)

//     render(<WrapperComponent complianceReportId="123" compliancePeriod="2024" />)
//     const alertBox = screen.getByTestId('alert-box')
//     expect(alertBox).toBeInTheDocument()
//     expect(alertBox.textContent).toContain('Test Alert Message')
//   })

//   test('displays loading indicator while loading data', () => {
//     vi.mock('@/hooks/useOtherUses', () => ({
//       useOtherUsesOptions: () => ({
//         data: null,
//         isLoading: true,
//         isFetched: false,
//       }),
//       useGetAllOtherUses: (complianceReportId) => ({
//         data: null,
//         isLoading: true,
//       }),
//       useSaveOtherUses: () => ({
//         mutate: vi.fn()
//       })
//     }))

//     render(<WrapperComponent complianceReportId="123" compliancePeriod="2024" />)
//     const loadingIndicator = screen.getByTestId('loading-indicator')
//     expect(loadingIndicator).toBeInTheDocument()
//   })

//   test('clicking save button stops grid editing', () => {
//     render(<WrapperComponent complianceReportId="123" compliancePeriod="2024" />)
//     const saveButton = screen.getByText('Save Other Uses')
//     fireEvent.click(saveButton)
//     // Assuming `gridApi.stopEditing` gets called on click
//     expect(saveButton).toBeInTheDocument()
//   })

//   test('displays error message if data load fails', () => {
//     vi.mock('@/hooks/useOtherUses', () => ({
//       useOtherUsesOptions: () => ({
//         data: null,
//         isLoading: false,
//         isFetched: true,
//       }),
//       useGetAllOtherUses: (complianceReportId) => ({
//         data: null,
//         isLoading: false,
//         error: new Error('Data Load Failed')
//       }),
//       useSaveOtherUses: () => ({
//         mutate: vi.fn()
//       })
//     }))

//     render(<WrapperComponent complianceReportId="123" compliancePeriod="2024" />)
//     const alertBox = screen.getByTestId('alert-box')
//     expect(alertBox).toBeInTheDocument()
//     expect(alertBox.textContent).toContain('Failed to load other uses.')
//   })

//   test('correctly initializes grid data', () => {
//     render(<WrapperComponent complianceReportId="123" compliancePeriod="2024" />)
//     const gridEditor = screen.getByTestId('mockedBCDataGridEditor')
//     expect(gridEditor).toBeInTheDocument()
//   })

//   test('adds new row on add row button click', async () => {
//     render(<WrapperComponent complianceReportId="123" compliancePeriod="2024" />)
//     const addRowButton = screen.getByText('Add Row')
//     fireEvent.click(addRowButton)
//     await waitFor(() => {
//       const gridEditor = screen.getByTestId('mockedBCDataGridEditor')
//       expect(gridEditor).toBeInTheDocument()
//       // Add more assertions as needed to check the row addition
//     })
//   })
// })
