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
})
