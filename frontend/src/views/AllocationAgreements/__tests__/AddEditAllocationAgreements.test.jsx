// import React from 'react'
// import { render, screen, fireEvent } from '@testing-library/react'
// import { describe, it, expect, beforeEach, vi } from 'vitest'
// import { AddEditAllocationAgreements } from '../AddEditAllocationAgreements'
// import * as useAllocationAgreementHook from '@/hooks/useAllocationAgreement'
// import { useComplianceReportWithCache } from '@/hooks/useComplianceReports'
// import { useCurrentUser } from '@/hooks/useCurrentUser'
// import { wrapper } from '@/tests/utils/wrapper'
// import * as configModule from '@/constants/config'

// // Mock react-router-dom hooks
// const mockUseLocation = vi.fn()
// const mockUseNavigate = vi.fn()
// const mockUseParams = vi.fn()

// vi.mock('@/hooks/useCurrentUser')
// vi.mock('@/hooks/useComplianceReports')

// vi.mock('@react-keycloak/web', () => ({
//   ReactKeycloakProvider: ({ children }) => children,
//   useKeycloak: () => ({
//     keycloak: {
//       authenticated: true,
//       login: vi.fn(),
//       logout: vi.fn(),
//       register: vi.fn()
//     },
//     initialized: true
//   })
// }))

// vi.mock('react-router-dom', () => ({
//   ...vi.importActual('react-router-dom'),
//   useLocation: () => mockUseLocation(),
//   useNavigate: () => mockUseNavigate(),
//   useParams: () => mockUseParams(),
//   useSearchParams: () => [new URLSearchParams(''), vi.fn()]
// }))

// // Mock react-i18next
// vi.mock('react-i18next', () => ({
//   useTranslation: () => ({
//     t: vi.fn((key, options = {}) => {
//       // Handle specific keys with returnObjects
//       if (
//         key === 'allocationAgreement:allocationAgreementGuides' &&
//         options.returnObjects
//       ) {
//         return ['Guide 1', 'Guide 2', 'Guide 3']
//       }
//       return key
//     })
//   })
// }))

// // Mock hooks related to allocation agreements
// vi.mock('@/hooks/useAllocationAgreement')

// vi.mock('@/constants/config', () => ({
//   FEATURE_FLAGS: {
//     ALLOCATION_AGREEMENT_IMPORT_EXPORT: 'ALLOCATION_AGREEMENT_IMPORT_EXPORT'
//   },
//   isFeatureEnabled: vi.fn()
// }))

// vi.mock('@/services/useApiService', () => ({
//   useApiService: () => ({
//     download: vi.fn()
//   })
// }))

// // Mock uuid
// vi.mock('uuid', () => ({
//   v4: vi.fn(() => 'mocked-uuid-1234')
// }))

// // Mock utility functions
// vi.mock('@/utils/schedules', () => ({
//   handleScheduleDelete: vi.fn(),
//   handleScheduleSave: vi.fn()
// }))

// vi.mock('@/utils/grid/changelogCellStyle', () => ({
//   changelogRowStyle: vi.fn()
// }))

// vi.mock('@/routes/routes', () => ({
//   ROUTES: {
//     REPORTS: {
//       VIEW: '/reports/view'
//     }
//   },
//   buildPath: vi.fn(
//     (route, params) =>
//       `/reports/view/${params.compliancePeriod}/${params.complianceReportId}`
//   )
// }))

// vi.mock('@/constants/common', () => ({
//   DEFAULT_CI_FUEL: {}
// }))

// vi.mock('@/constants/routes/apiRoutes', () => ({
//   apiRoutes: {
//     exportAllocationAgreements: '/api/export/:reportID',
//     downloadAllocationAgreementsTemplate: '/api/template/:reportID'
//   }
// }))

// // Mock schema
// vi.mock('../_schema', () => ({
//   defaultColDef: {},
//   allocationAgreementColDefs: vi.fn(() => []),
//   PROVISION_APPROVED_FUEL_CODE: 'APPROVED_FUEL_CODE'
// }))

// // Mock BCGridEditor component
// vi.mock('@/components/BCDataGrid/BCGridEditor', () => ({
//   BCGridEditor: ({
//     gridRef,
//     alertRef,
//     onGridReady,
//     rowData,
//     onCellValueChanged,
//     onCellEditingStopped
//   }) => {
//     // Simulate onGridReady being called
//     React.useEffect(() => {
//       if (onGridReady) {
//         onGridReady({
//           api: {
//             sizeColumnsToFit: vi.fn(),
//             getLastDisplayedRowIndex: vi.fn(() => 0),
//             setFocusedCell: vi.fn(),
//             startEditingCell: vi.fn()
//           }
//         })
//       }
//     }, [onGridReady])

//     return (
//       <div data-test="bc-grid-editor">
//         <div data-test="row-data">
//           {rowData.map((row, index) => (
//             <div key={index} data-test="grid-row">
//               {row.id}
//             </div>
//           ))}
//         </div>
//       </div>
//     )
//   }
// }))

// vi.mock('@/components/ImportDialog', () => ({
//   default: ({ open, close }) => (
//     <div data-testid="import-dialog" aria-hidden={!open}>
//       <button onClick={close} data-testid="close-dialog">
//         Close
//       </button>
//     </div>
//   )
// }))

// // Mock Material-UI components
// vi.mock('@mui/material', () => ({
//   Menu: ({ children, open, onClose }) =>
//     open ? (
//       <div data-testid="menu" onClick={onClose}>
//         {children}
//       </div>
//     ) : null,
//   MenuItem: ({ children, onClick }) => (
//     <div data-testid="menu-item" onClick={onClick}>
//       {children}
//     </div>
//   )
// }))

// // Mock other BC components
// vi.mock('@/components/BCTypography', () => ({
//   default: ({ children }) => <div>{children}</div>
// }))

// vi.mock('@/components/BCBox', () => ({
//   default: ({ children }) => <div>{children}</div>
// }))

// vi.mock('@/components/BCButton', () => ({
//   default: ({ children, onClick, isLoading, disabled }) => (
//     <button onClick={onClick} disabled={disabled || isLoading}>
//       {children}
//     </button>
//   )
// }))

// vi.mock('@mui/material/Grid2', () => ({
//   default: ({ children }) => <div>{children}</div>
// }))

// vi.mock('@fortawesome/react-fontawesome', () => ({
//   FontAwesomeIcon: () => <span>icon</span>
// }))

// vi.mock('@fortawesome/free-solid-svg-icons', () => ({
//   faCaretDown: 'caret-down'
// }))

// vi.mock('@/contexts/AuthorizationContext', () => ({
//   useAuthorization: () => ({
//     setForbidden: vi.fn()
//   })
// }))

// describe('AddEditAllocationAgreements', () => {
//   beforeEach(() => {
//     vi.resetAllMocks()

//     // Mock react-router-dom hooks with complete location object
//     mockUseLocation.mockReturnValue({
//       pathname: '/test-path',
//       state: {}
//     })
//     mockUseNavigate.mockReturnValue(vi.fn())
//     mockUseParams.mockReturnValue({
//       complianceReportId: 'testReportId',
//       compliancePeriod: '2024'
//     })

//     // Mock useGetAllocationAgreementsList hook
//     vi.mocked(
//       useAllocationAgreementHook.useGetAllocationAgreementsList
//     ).mockReturnValue({
//       data: { allocationAgreements: [] },
//       isLoading: false,
//       refetch: vi.fn()
//     })

//     // Mock useAllocationAgreementOptions hook
//     vi.mocked(
//       useAllocationAgreementHook.useAllocationAgreementOptions
//     ).mockReturnValue({
//       data: { fuelTypes: [] },
//       isLoading: false,
//       isFetched: true
//     })

//     // Mock useSaveAllocationAgreement hook
//     vi.mocked(
//       useAllocationAgreementHook.useSaveAllocationAgreement
//     ).mockReturnValue({
//       mutateAsync: vi.fn()
//     })

//     vi.mocked(
//       useAllocationAgreementHook.useImportAllocationAgreement
//     ).mockReturnValue({
//       mutateAsync: vi.fn()
//     })

//     vi.mocked(
//       useAllocationAgreementHook.useGetAllocationAgreementImportJobStatus
//     ).mockReturnValue({
//       data: null,
//       isLoading: false
//     })

//     useCurrentUser.mockReturnValue({
//       data: {
//         organization: { organizationId: 1, name: 'Test Org' }
//       }
//     })

//     useComplianceReportWithCache.mockReturnValue({
//       data: {
//         report: {
//           version: 0,
//           organization: { name: 'Test Org' }
//         }
//       },
//       isLoading: false
//     })

//     vi.mocked(configModule.isFeatureEnabled).mockReturnValue(false)
//   })

//   it('renders the component', () => {
//     render(<AddEditAllocationAgreements />, { wrapper })
//     expect(
//       screen.getByText('allocationAgreement:allocationAgreementTitle')
//     ).toBeInTheDocument()
//   })

//   it('initializes with at least one row in the empty state', async () => {
//     render(<AddEditAllocationAgreements />, { wrapper })

//     // Wait for the component to finish rendering and grid to be ready
//     await screen.findByTestId('bc-grid-editor')

//     const rows = screen.getAllByTestId('grid-row')
//     expect(rows.length).toBe(1) // Ensure at least one row exists
//   })

//   it('loads data when allocationAgreements are available', async () => {
//     const mockData = {
//       allocationAgreements: [
//         { allocationAgreementId: 'testId1' },
//         { allocationAgreementId: 'testId2' }
//       ]
//     }

//     vi.mocked(
//       useAllocationAgreementHook.useGetAllocationAgreementsList
//     ).mockReturnValue({
//       data: mockData,
//       isLoading: false,
//       refetch: vi.fn()
//     })

//     render(<AddEditAllocationAgreements />, { wrapper })

//     // Wait for the component to finish rendering
//     await screen.findByTestId('bc-grid-editor')

//     const rows = screen.getAllByTestId('grid-row')
//     expect(rows.length).toBe(3) // 2 data rows + 1 empty row

//     // Check that each row's textContent matches the mocked UUID
//     rows.forEach((row) => {
//       expect(row.textContent).toBe('mocked-uuid-1234')
//     })
//   })

//   it('does not show import/export buttons when feature flag is disabled', () => {
//     vi.mocked(configModule.isFeatureEnabled).mockReturnValue(false)

//     render(<AddEditAllocationAgreements />, { wrapper })

//     expect(
//       screen.queryByText('common:importExport.export.btn')
//     ).not.toBeInTheDocument()
//     expect(
//       screen.queryByText('common:importExport.import.btn')
//     ).not.toBeInTheDocument()
//   })

//   it('shows import/export buttons when feature flag is enabled', () => {
//     vi.mocked(configModule.isFeatureEnabled).mockReturnValue(true)

//     render(<AddEditAllocationAgreements />, { wrapper })

//     expect(
//       screen.getByText('common:importExport.export.btn')
//     ).toBeInTheDocument()
//     expect(
//       screen.getByText('common:importExport.import.btn')
//     ).toBeInTheDocument()
//   })

//   it('hides overwrite option for supplemental reports with existing data', () => {
//     useComplianceReportWithCache.mockReturnValue({
//       data: {
//         report: {
//           version: 1,
//           organization: { name: 'Test Org' }
//         }
//       },
//       isLoading: false
//     })

//     // Mock data to simulate "existing allocation agreement rows"
//     const mockExistingData = {
//       allocationAgreements: [{ allocationAgreementId: 'testId1' }]
//     }

//     vi.mocked(
//       useAllocationAgreementHook.useGetAllocationAgreementsList
//     ).mockReturnValue({
//       data: mockExistingData,
//       isLoading: false,
//       refetch: vi.fn()
//     })

//     vi.mocked(configModule.isFeatureEnabled).mockReturnValue(true)

//     render(<AddEditAllocationAgreements />, { wrapper })

//     fireEvent.click(screen.getByText('common:importExport.import.btn'))

//     // The menu should be visible and contain only append option
//     expect(
//       screen.queryByText('common:importExport.import.dialog.buttons.overwrite')
//     ).not.toBeInTheDocument()
//     expect(
//       screen.getByText('common:importExport.import.dialog.buttons.append')
//     ).toBeInTheDocument()
//   })

//   it('shows both import options for original reports', () => {
//     useComplianceReportWithCache.mockReturnValue({
//       data: {
//         report: {
//           version: 0,
//           organization: { name: 'Test Org' }
//         }
//       },
//       isLoading: false
//     })

//     vi.mocked(configModule.isFeatureEnabled).mockReturnValue(true)

//     render(<AddEditAllocationAgreements />, { wrapper })

//     fireEvent.click(screen.getByText('common:importExport.import.btn'))

//     // The menu should be visible and contain both options
//     expect(
//       screen.getByText('common:importExport.import.dialog.buttons.overwrite')
//     ).toBeInTheDocument()
//     expect(
//       screen.getByText('common:importExport.import.dialog.buttons.append')
//     ).toBeInTheDocument()
//   })
// })
describe.todo()