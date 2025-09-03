import { render, screen } from '@testing-library/react'
import { ViewAuditLog } from '../ViewAuditLog'
import { useAuditLog } from '@/hooks/useAuditLog'
import { useParams } from 'react-router-dom'
import { vi } from 'vitest'

// Mock necessary modules
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useParams: vi.fn()
}))

vi.mock('@/hooks/useAuditLog', () => ({
  useAuditLog: vi.fn()
}))

vi.mock('@/components/Loading', () => ({
  default: () => <div data-test="loading">Loading...</div>
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key)
  })
}))

describe('ViewAuditLog Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state', () => {
    useParams.mockReturnValue({ auditLogId: '123' })
    useAuditLog.mockReturnValue({ isLoading: true })
    render(<ViewAuditLog />)
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('renders error state', () => {
    useParams.mockReturnValue({ auditLogId: '123' })
    useAuditLog.mockReturnValue({
      isLoading: false,
      isError: true,
      error: { message: 'Error occurred' }
    })
    render(<ViewAuditLog />)
    expect(screen.getByText('Error: Error occurred')).toBeInTheDocument()
  })

  it('renders audit log details correctly', () => {
    useParams.mockReturnValue({ auditLogId: '123' })
    useAuditLog.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        auditLogId: 123,
        tableName: 'users',
        operation: 'UPDATE',
        rowId: '{"id":1}',
        createDate: '2023-08-01T12:00:00Z',
        createUser: 'admin',
        oldValues: { name: 'Old Name', age: 30 },
        newValues: { name: 'New Name', age: 31 },
        delta: { name: 'New Name', age: 31 }
      }
    })
    render(<ViewAuditLog />)

    // Check that heading is rendered
    expect(screen.getByText(/AuditLogDetails/)).toBeInTheDocument()

    // Check that key information is displayed
    expect(screen.getByText('auditLogColLabels.tableName:')).toBeInTheDocument()
    expect(screen.getByText('users')).toBeInTheDocument()
    expect(screen.getByText('auditLogColLabels.operation:')).toBeInTheDocument()
    expect(screen.getByText('UPDATE')).toBeInTheDocument()
    expect(screen.getByText('auditLogColLabels.rowId:')).toBeInTheDocument()
    expect(screen.getByText('{"id":1}')).toBeInTheDocument()
    expect(
      screen.getByText('auditLogColLabels.createDate:')
    ).toBeInTheDocument()
    expect(
      screen.getByText(new Date('2023-08-01T12:00:00Z').toLocaleString())
    ).toBeInTheDocument()
    expect(screen.getByText('auditLogColLabels.userId:')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()

    // Check that the table displays the field changes
    expect(screen.getByText('name')).toBeInTheDocument()
    expect(screen.getByText('Old Name')).toBeInTheDocument()
    expect(screen.getByText('New Name')).toBeInTheDocument()

    expect(screen.getByText('age')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('31')).toBeInTheDocument()
  })

  it('handles INSERT operation correctly', () => {
    useParams.mockReturnValue({ auditLogId: '124' })
    useAuditLog.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        auditLogId: 124,
        tableName: 'users',
        operation: 'INSERT',
        rowId: '{"id":2}',
        createDate: '2023-08-02T12:00:00Z',
        createUser: 'admin',
        oldValues: null,
        newValues: { name: 'New User', age: 25 },
        delta: null
      }
    })
    render(<ViewAuditLog />)

    // Check that 'name' row displays correctly
    const nameCells = screen.getAllByText('name')
    const nameRow = nameCells[0].closest('tr')
    const nameRowCells = nameRow.querySelectorAll('td')
    expect(nameRowCells[1].textContent).toBe('') // Old value cell should be empty
    expect(nameRowCells[2].textContent).toBe('New User') // New value cell

    // Check that 'age' row displays correctly
    const ageCells = screen.getAllByText('age')
    const ageRow = ageCells[0].closest('tr')
    const ageRowCells = ageRow.querySelectorAll('td')
    expect(ageRowCells[1].textContent).toBe('') // Old value cell should be empty
    expect(ageRowCells[2].textContent).toBe('25') // New value cell
  })

  it('handles DELETE operation correctly', () => {
    useParams.mockReturnValue({ auditLogId: '125' })
    useAuditLog.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        auditLogId: 125,
        tableName: 'users',
        operation: 'DELETE',
        rowId: '{"id":3}',
        createDate: '2023-08-03T12:00:00Z',
        createUser: 'admin',
        oldValues: { name: 'Deleted User', age: 40 },
        newValues: null,
        delta: null
      }
    })
    render(<ViewAuditLog />)

    // Check that 'name' row displays correctly
    const nameCells = screen.getAllByText('name')
    const nameRow = nameCells[0].closest('tr')
    const nameRowCells = nameRow.querySelectorAll('td')
    expect(nameRowCells[1].textContent).toBe('Deleted User') // Old value cell
    expect(nameRowCells[2].textContent).toBe('') // New value cell should be empty

    // Check that 'age' row displays correctly
    const ageCells = screen.getAllByText('age')
    const ageRow = ageCells[0].closest('tr')
    const ageRowCells = ageRow.querySelectorAll('td')
    expect(ageRowCells[1].textContent).toBe('40') // Old value cell
    expect(ageRowCells[2].textContent).toBe('') // New value cell should be empty
  })

  it('applies correct styling for INSERT operation', () => {
    useParams.mockReturnValue({ auditLogId: '124' })
    useAuditLog.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        auditLogId: 124,
        tableName: 'users',
        operation: 'INSERT',
        rowId: '{"id":2}',
        createDate: '2023-08-02T12:00:00Z',
        createUser: 'admin',
        oldValues: null,
        newValues: { name: 'New User' },
        delta: null
      }
    })
    render(<ViewAuditLog />)

    // Check that INSERT operation applies light green background
    const nameRow = screen.getByText('name').closest('tr')
    expect(nameRow).toHaveStyle('background-color: rgb(232, 245, 233)') // Light green
  })

  it('applies correct styling for DELETE operation', () => {
    useParams.mockReturnValue({ auditLogId: '125' })
    useAuditLog.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        auditLogId: 125,
        tableName: 'users',
        operation: 'DELETE',
        rowId: '{"id":3}',
        createDate: '2023-08-03T12:00:00Z',
        createUser: 'admin',
        oldValues: { name: 'Deleted User' },
        newValues: null,
        delta: null
      }
    })
    render(<ViewAuditLog />)

    // Check that DELETE operation applies light red background
    const nameRow = screen.getByText('name').closest('tr')
    expect(nameRow).toHaveStyle('background-color: rgb(255, 235, 238)') // Light red
  })

  it('highlights changed fields in UPDATE operation', () => {
    useParams.mockReturnValue({ auditLogId: '123' })
    useAuditLog.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        auditLogId: 123,
        tableName: 'users',
        operation: 'UPDATE',
        rowId: '{"id":1}',
        createDate: '2023-08-01T12:00:00Z',
        createUser: 'admin',
        oldValues: { name: 'Old Name', age: 30, status: 'active' },
        newValues: { name: 'New Name', age: 30, status: 'active' },
        delta: { name: 'New Name' } // Only name changed
      }
    })
    render(<ViewAuditLog />)

    // Check that changed field (name) has blue background
    const nameRow = screen.getByText('name').closest('tr')
    expect(nameRow).toHaveStyle('background-color: rgb(227, 242, 253)') // Light blue

    // Check that unchanged fields don't have special styling
    const ageRow = screen.getByText('age').closest('tr')
    expect(ageRow).not.toHaveStyle('background-color: rgb(227, 242, 253)')

    // Check that changed fields are bold
    const nameRowCells = nameRow.querySelectorAll('td')
    const oldNameCell = nameRowCells[1].querySelector('strong')
    const newNameCell = nameRowCells[2].querySelector('strong')
    expect(oldNameCell).toBeInTheDocument()
    expect(newNameCell).toBeInTheDocument()
    expect(oldNameCell.textContent).toBe('Old Name')
    expect(newNameCell.textContent).toBe('New Name')
  })

  it('handles object values with formatValue function', () => {
    useParams.mockReturnValue({ auditLogId: '126' })
    useAuditLog.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        auditLogId: 126,
        tableName: 'users',
        operation: 'UPDATE',
        rowId: '{"id":4}',
        createDate: '2023-08-04T12:00:00Z',
        createUser: 'admin',
        oldValues: { 
          metadata: { role: 'user', permissions: ['read'] }
        },
        newValues: { 
          metadata: { role: 'admin', permissions: ['read', 'write'] }
        },
        delta: { metadata: { role: 'admin', permissions: ['read', 'write'] } }
      }
    })
    render(<ViewAuditLog />)

    // Check that object values are formatted as JSON
    expect(screen.getByText('metadata')).toBeInTheDocument()
    
    // The object should be JSON stringified - use more flexible text matching
    expect(screen.getByText((content, element) => {
      return content.includes('"role": "user"') && content.includes('"permissions"')
    })).toBeInTheDocument()
    
    expect(screen.getByText((content, element) => {
      return content.includes('"role": "admin"') && content.includes('"read"') && content.includes('"write"')
    })).toBeInTheDocument()
  })

  it('handles null and undefined values with formatValue function', () => {
    useParams.mockReturnValue({ auditLogId: '127' })
    useAuditLog.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        auditLogId: 127,
        tableName: 'users',
        operation: 'UPDATE',
        rowId: '{"id":5}',
        createDate: '2023-08-05T12:00:00Z',
        createUser: 'admin',
        oldValues: { 
          name: 'Test User',
          email: null,
          phone: undefined
        },
        newValues: { 
          name: 'Test User',
          email: 'test@example.com',
          phone: '123-456-7890'
        },
        delta: { email: 'test@example.com', phone: '123-456-7890' }
      }
    })
    render(<ViewAuditLog />)

    // Check that null/undefined values render as empty strings
    const emailRow = screen.getByText('email').closest('tr')
    const emailRowCells = emailRow.querySelectorAll('td')
    expect(emailRowCells[1].textContent).toBe('') // Old value (null) should be empty

    const phoneRow = screen.getByText('phone').closest('tr')
    const phoneRowCells = phoneRow.querySelectorAll('td')
    expect(phoneRowCells[1].textContent).toBe('') // Old value (undefined) should be empty
  })

  it('handles missing oldValues or newValues gracefully', () => {
    useParams.mockReturnValue({ auditLogId: '128' })
    useAuditLog.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        auditLogId: 128,
        tableName: 'users',
        operation: 'INSERT',
        rowId: '{"id":6}',
        createDate: '2023-08-06T12:00:00Z',
        createUser: 'admin',
        oldValues: null, // No old values
        newValues: { name: 'New User', age: 25 },
        delta: null
      }
    })
    render(<ViewAuditLog />)

    // Should still create fieldNames array from newValues only
    expect(screen.getByText('name')).toBeInTheDocument()
    expect(screen.getByText('age')).toBeInTheDocument()

    // Old value cells should be empty
    const nameRow = screen.getByText('name').closest('tr')
    const nameRowCells = nameRow.querySelectorAll('td')
    expect(nameRowCells[1].textContent).toBe('') // Old value cell should be empty
    expect(nameRowCells[2].textContent).toBe('New User') // New value cell
  })

  it('renders table headers correctly', () => {
    useParams.mockReturnValue({ auditLogId: '129' })
    useAuditLog.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        auditLogId: 129,
        tableName: 'users',
        operation: 'UPDATE',
        rowId: '{"id":7}',
        createDate: '2023-08-07T12:00:00Z',
        createUser: 'admin',
        oldValues: { name: 'Old Name' },
        newValues: { name: 'New Name' },
        delta: { name: 'New Name' }
      }
    })
    render(<ViewAuditLog />)

    // Check table headers
    expect(screen.getByText('Field')).toBeInTheDocument()
    expect(screen.getByText('OldValue')).toBeInTheDocument()
    expect(screen.getByText('NewValue')).toBeInTheDocument()
  })

  it('handles System user when createUser is null', () => {
    useParams.mockReturnValue({ auditLogId: '130' })
    useAuditLog.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        auditLogId: 130,
        tableName: 'users',
        operation: 'UPDATE',
        rowId: '{"id":8}',
        createDate: '2023-08-08T12:00:00Z',
        createUser: null, // System operation
        oldValues: { name: 'Old Name' },
        newValues: { name: 'New Name' },
        delta: { name: 'New Name' }
      }
    })
    render(<ViewAuditLog />)

    // Check that System is displayed when createUser is null
    expect(screen.getByText('auditLogColLabels.userId:')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()
  })

  it('merges oldValues and newValues keys correctly for fieldNames array', () => {
    useParams.mockReturnValue({ auditLogId: '131' })
    useAuditLog.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        auditLogId: 131,
        tableName: 'users',
        operation: 'UPDATE',
        rowId: '{"id":9}',
        createDate: '2023-08-09T12:00:00Z',
        createUser: 'admin',
        oldValues: { name: 'Old Name', email: 'old@example.com' },
        newValues: { name: 'New Name', phone: '123-456-7890' },
        delta: { name: 'New Name', phone: '123-456-7890' }
      }
    })
    render(<ViewAuditLog />)

    // Should display all unique fields from both oldValues and newValues
    expect(screen.getByText('name')).toBeInTheDocument()
    expect(screen.getByText('email')).toBeInTheDocument()
    expect(screen.getByText('phone')).toBeInTheDocument()

    // Check values are displayed correctly
    const emailRow = screen.getByText('email').closest('tr')
    const emailRowCells = emailRow.querySelectorAll('td')
    expect(emailRowCells[1].textContent).toBe('old@example.com') // Old value
    expect(emailRowCells[2].textContent).toBe('') // New value should be empty

    const phoneRow = screen.getByText('phone').closest('tr')
    const phoneRowCells = phoneRow.querySelectorAll('td')
    expect(phoneRowCells[1].textContent).toBe('') // Old value should be empty
    expect(phoneRowCells[2].textContent).toBe('123-456-7890') // New value
  })
})
