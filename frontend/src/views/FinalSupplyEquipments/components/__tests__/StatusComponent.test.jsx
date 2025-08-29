import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock external components
vi.mock('@/components/BCButton', () => ({
  default: ({ children, ...rest }) => <button {...rest}>{children}</button>
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, gutterBottom, ...rest }) => <div {...rest}>{children}</div>
}))

vi.mock('@mui/material', () => ({
  Alert: ({ children, severity, ...rest }) => (
    <div data-test="alert" data-severity={severity} {...rest}>
      {children}
    </div>
  ),
  CircularProgress: ({ size }) => (
    <div data-test="progress" data-size={size} />
  )
}))

import {
  GeofencingStatus,
  OverlapSummary,
  LoadingState,
  ErrorState,
  NoDataState
} from '../StatusComponent'

describe('StatusComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GeofencingStatus', () => {
    it('renders loading state correctly', () => {
      render(<GeofencingStatus status="loading" />)
      
      expect(screen.getByTestId('alert')).toHaveAttribute('data-severity', 'info')
      expect(screen.getByText('Geofencing in progress...')).toBeInTheDocument()
      expect(
        screen.getByText(/Checking each location to determine if it's inside BC's boundaries/)
      ).toBeInTheDocument()
    })

    it('renders error state correctly', () => {
      render(<GeofencingStatus status="error" />)
      
      expect(screen.getByTestId('alert')).toHaveAttribute('data-severity', 'error')
      expect(screen.getByText('Geofencing error')).toBeInTheDocument()
      expect(
        screen.getByText(/There was an error checking location boundaries/)
      ).toBeInTheDocument()
    })

    it('returns null for unknown status', () => {
      const { container } = render(<GeofencingStatus status="unknown" />)
      expect(container.firstChild).toBeNull()
    })

    it('returns null for undefined status', () => {
      const { container } = render(<GeofencingStatus />)
      expect(container.firstChild).toBeNull()
    })

    it('returns null for null status', () => {
      const { container } = render(<GeofencingStatus status={null} />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('OverlapSummary', () => {
    const mockOverlapStatsWithOverlaps = {
      total: 10,
      overlapping: 3,
      nonOverlapping: 7,
      bcOverlapping: 2,
      nonBcOverlapping: 1
    }

    const mockOverlapStatsNoOverlaps = {
      total: 5,
      overlapping: 0,
      nonOverlapping: 5,
      bcOverlapping: 0,
      nonBcOverlapping: 0
    }

    it('renders warning severity when overlaps exist', () => {
      render(<OverlapSummary overlapStats={mockOverlapStatsWithOverlaps} />)
      
      expect(screen.getByTestId('alert')).toHaveAttribute('data-severity', 'warning')
      expect(screen.getByText('Period Overlaps Detected')).toBeInTheDocument()
    })

    it('renders success severity when no overlaps exist', () => {
      render(<OverlapSummary overlapStats={mockOverlapStatsNoOverlaps} />)
      
      expect(screen.getByTestId('alert')).toHaveAttribute('data-severity', 'success')
      expect(screen.getByText('No Period Overlaps')).toBeInTheDocument()
    })

    it('displays all statistics correctly with overlaps', () => {
      render(<OverlapSummary overlapStats={mockOverlapStatsWithOverlaps} />)
      
      expect(screen.getByText('Total Supply Units:')).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument()
      expect(screen.getByText('Units with Overlaps:')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('Units without Overlaps:')).toBeInTheDocument()
      expect(screen.getByText('7')).toBeInTheDocument()
      expect(screen.getByText('BC Units with Overlaps:')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('Outside BC with Overlaps:')).toBeInTheDocument()
      expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('displays all statistics correctly without overlaps', () => {
      render(<OverlapSummary overlapStats={mockOverlapStatsNoOverlaps} />)
      
      expect(screen.getByText('Total Supply Units:')).toBeInTheDocument()
      expect(screen.getAllByText('5')).toHaveLength(2) // total and nonOverlapping are both 5
      expect(screen.getByText('Units with Overlaps:')).toBeInTheDocument()
      expect(screen.getAllByText('0')).toHaveLength(3) // overlapping, bcOverlapping, nonBcOverlapping
      expect(screen.getByText('Units without Overlaps:')).toBeInTheDocument()
    })

    it('handles edge case with zero total', () => {
      const zeroStats = {
        total: 0,
        overlapping: 0,
        nonOverlapping: 0,
        bcOverlapping: 0,
        nonBcOverlapping: 0
      }
      render(<OverlapSummary overlapStats={zeroStats} />)
      
      expect(screen.getByTestId('alert')).toHaveAttribute('data-severity', 'success')
      expect(screen.getAllByText('0')).toHaveLength(5) // All 5 stats are 0
    })
  })

  describe('LoadingState', () => {
    it('renders loading alert with progress indicator', () => {
      render(<LoadingState />)
      
      expect(screen.getByTestId('alert')).toHaveAttribute('data-severity', 'info')
      expect(screen.getByText('Loading map data...')).toBeInTheDocument()
    })
  })

  describe('ErrorState', () => {
    const mockRefetch = vi.fn()
    const mockResetGeofencing = vi.fn()

    beforeEach(() => {
      mockRefetch.mockClear()
      mockResetGeofencing.mockClear()
    })

    it('renders error message when provided', () => {
      const error = { message: 'Network error occurred' }
      render(
        <ErrorState
          error={error}
          refetch={mockRefetch}
          resetGeofencing={mockResetGeofencing}
        />
      )
      
      expect(screen.getByTestId('alert')).toHaveAttribute('data-severity', 'error')
      expect(screen.getByText('Error: Network error occurred')).toBeInTheDocument()
      expect(
        screen.getByText(/Please ensure the API provides location data/)
      ).toBeInTheDocument()
    })

    it('renders fallback message when error has no message', () => {
      const error = {}
      render(
        <ErrorState
          error={error}
          refetch={mockRefetch}
          resetGeofencing={mockResetGeofencing}
        />
      )
      
      expect(screen.getByText('Error: Failed to load data')).toBeInTheDocument()
    })

    it('renders fallback message when error is null', () => {
      render(
        <ErrorState
          error={null}
          refetch={mockRefetch}
          resetGeofencing={mockResetGeofencing}
        />
      )
      
      expect(screen.getByText('Error: Failed to load data')).toBeInTheDocument()
    })

    it('renders fallback message when error is undefined', () => {
      render(
        <ErrorState
          refetch={mockRefetch}
          resetGeofencing={mockResetGeofencing}
        />
      )
      
      expect(screen.getByText('Error: Failed to load data')).toBeInTheDocument()
    })

    it('calls both refetch and resetGeofencing when button clicked', async () => {
      render(
        <ErrorState
          error={{ message: 'Test error' }}
          refetch={mockRefetch}
          resetGeofencing={mockResetGeofencing}
        />
      )
      
      const button = screen.getByRole('button', { name: /Refresh Map Data/i })
      await userEvent.click(button)
      
      expect(mockRefetch).toHaveBeenCalledTimes(1)
      expect(mockResetGeofencing).toHaveBeenCalledTimes(1)
    })
  })

  describe('NoDataState', () => {
    const mockRefetch = vi.fn()
    const mockResetGeofencing = vi.fn()

    beforeEach(() => {
      mockRefetch.mockClear()
      mockResetGeofencing.mockClear()
    })

    it('renders no data message and requirements list', () => {
      render(
        <NoDataState
          refetch={mockRefetch}
          resetGeofencing={mockResetGeofencing}
        />
      )
      
      expect(screen.getByTestId('alert')).toHaveAttribute('data-severity', 'warning')
      expect(screen.getByText('No location data found')).toBeInTheDocument()
      expect(
        screen.getByText('API should return data with the following fields:')
      ).toBeInTheDocument()
      
      // Check all required fields are listed
      expect(screen.getByText(/serialNbr \(for ID creation\)/)).toBeInTheDocument()
      expect(
        screen.getByText(/streetAddress, city, postalCode \(for location name\)/)
      ).toBeInTheDocument()
      expect(screen.getByText(/latitude and longitude/)).toBeInTheDocument()
      expect(screen.getByText(/supplyFromDate and supplyToDate/)).toBeInTheDocument()
    })

    it('calls both refetch and resetGeofencing when button clicked', async () => {
      render(
        <NoDataState
          refetch={mockRefetch}
          resetGeofencing={mockResetGeofencing}
        />
      )
      
      const button = screen.getByRole('button', { name: /Refresh Map Data/i })
      await userEvent.click(button)
      
      expect(mockRefetch).toHaveBeenCalledTimes(1)
      expect(mockResetGeofencing).toHaveBeenCalledTimes(1)
    })

    it('renders button with correct styling attributes', () => {
      render(
        <NoDataState
          refetch={mockRefetch}
          resetGeofencing={mockResetGeofencing}
        />
      )
      
      const button = screen.getByRole('button', { name: /Refresh Map Data/i })
      expect(button).toHaveAttribute('variant', 'outlined')
      expect(button).toHaveAttribute('color', 'dark')
    })
  })
})
