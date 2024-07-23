describe.todo()
// import { render, screen } from '@testing-library/react'
// import { describe, it, expect, beforeEach, vi } from 'vitest'
// import OrganizationList from '../OrganizationList'
// import { ThemeProvider } from '@mui/material'
// import theme from '@/themes'

// // Mock the translation function
// vi.mock('react-i18next', () => ({
//   useTranslation: () => ({
//     t: vi.fn((key) => key)
//   })
// }))

// // Mock the useOrganizationNames hook
// const mockOrganizations = [
//   {
//     organizationId: 1,
//     name: "Organization One",
//     totalBalance: 1000,
//     reservedBalance: 100
//   },
//   {
//     organizationId: 2,
//     name: "Organization Two",
//     totalBalance: 2000,
//     reservedBalance: 200
//   }
// ]

// vi.mock('@/hooks/useOrganization', () => ({
//   useOrganizationNames: () => ({
//     data: mockOrganizations,
//     isLoading: false
//   })
// }))

// const renderComponent = (props) => {
//   return render(
//     <ThemeProvider theme={theme}>
//       <OrganizationList {...props} />
//     </ThemeProvider>
//   )
// }

// describe('OrganizationList Component', () => {
//   beforeEach(() => {
//     vi.clearAllMocks()
//   })
  
//   const onOrgChange = vi.fn()

//   it('renders without crashing', () => {
//     renderComponent({ onOrgChange })
//     expect(screen.getByText(/txn:allOrganizations/i)).toBeInTheDocument()
//     expect(screen.getByText(/txn:showTransactionsInvolve/i)).toBeInTheDocument()
//   })
// })

