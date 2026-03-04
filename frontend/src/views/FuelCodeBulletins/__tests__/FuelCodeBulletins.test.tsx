import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
import FuelCodeBulletins from '../FuelCodeBulletins'
import { CurrentFuelCodes } from '../components/CurrentFuelCodes'
import { ArchivedFuelCodes } from '../components/ArchivedFuelCodes'

const mockUseFuelCodeBulletins = vi.fn()
const mockBCGridViewer = vi.fn()

vi.mock('@/utils/withRole', () => ({
  default: (Component: any) => Component
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'tabs.current': 'Current',
        'tabs.archived': 'Archived',
        'current.title': 'Approved carbon intensities - Current',
        'archived.title': 'Approved carbon intensities - Archived',
        'archived.description': 'Archived description',
        'common.fuelCodePrefix':
          "Fuel codes with a 'C-' prefix represent fuels produced in Canada.",
        'common.noRowsFound': 'No bulletin rows found',
        'common.errorLoading': 'Failed to load fuel code bulletins.',
        'columns.fuelCode': 'Fuel Code',
        'columns.fuel': 'Fuel',
        'columns.company': 'Company',
        'columns.carbonIntensity': 'Carbon Intensity (gCO2e/MJ)',
        'columns.effectiveDate': 'Effective Date',
        'columns.expiryDate': 'Expiry Date'
      }
      if (key === 'current.description') {
        return `Current description after ${options?.cutoffLabel}`
      }
      return translations[key] || key
    }
  })
}))

vi.mock('@/hooks/useFuelCode', () => ({
  useFuelCodeBulletins: (...args: any[]) => mockUseFuelCodeBulletins(...args)
}))

vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: (props: any) => {
    mockBCGridViewer(props)
    return (
      <div data-test={`bc-grid-viewer-${props.gridKey}`}>
        <button
          type="button"
          onClick={() =>
            props.onPaginationChange?.({
              page: 2,
              size: 50
            })
          }
        >
          Change pagination
        </button>
      </div>
    )
  }
}))

describe('FuelCodeBulletins UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseFuelCodeBulletins.mockImplementation((bulletinType) => {
      if (bulletinType === 'current') {
        return {
          data: {
            cutoffDate: '2026-03-31T12:00:00',
            fuelCodes: [
              {
                fuelCode: 'C-BCLCF264.3',
                fuel: 'CNG',
                company: 'FortisBC Energy Inc.',
                carbonIntensity: 2.89,
                effectiveDate: '2025-12-31',
                expiryDate: '2028-12-30'
              }
            ]
          },
          isLoading: false,
          isError: false,
          error: null
        }
      }

      return {
        data: {
          fuelCodes: [
            {
              fuelCode: 'BCLCF101.0',
              fuel: 'HDRD',
              company: 'Neste Oil Singapore',
              carbonIntensity: 8.61,
              effectiveDate: '2013-03-28',
              expiryDate: '2013-12-31'
            }
          ]
        },
        isLoading: false,
        isError: false,
        error: null
      }
    })
  })

  it('renders current bulletin by default and switches to archived tab', async () => {
    render(<FuelCodeBulletins />, { wrapper })

    expect(
      screen.getByText('Approved carbon intensities - Current')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('bc-grid-viewer-current-fuel-codes-grid')
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Archived' }))

    expect(
      screen.getByText('Approved carbon intensities - Archived')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('bc-grid-viewer-archived-fuel-codes-grid')
    ).toBeInTheDocument()
    expect(mockUseFuelCodeBulletins).toHaveBeenCalledWith(
      'archived',
      expect.any(Object)
    )
  })

  it('passes default grid config and pagination for current bulletin', () => {
    render(<CurrentFuelCodes />, { wrapper })

    const gridProps = mockBCGridViewer.mock.calls[0][0]
    expect(gridProps.paginationOptions).toEqual({
      page: 1,
      size: 25,
      sortOrders: [],
      filters: []
    })
    expect(gridProps.defaultColDef.sortable).toBe(true)
    expect(gridProps.defaultColDef.floatingFilter).toBe(true)
    expect(gridProps.overlayNoRowsTemplate).toBe('No bulletin rows found')
    expect(mockUseFuelCodeBulletins).toHaveBeenCalledWith(
      'current',
      expect.objectContaining({ page: 1, size: 25, sortOrders: [], filters: [] })
    )
  })

  it('updates pagination options after grid pagination change', async () => {
    render(<CurrentFuelCodes />, { wrapper })

    await userEvent.click(screen.getByRole('button', { name: 'Change pagination' }))

    await waitFor(() => {
      expect(mockUseFuelCodeBulletins).toHaveBeenCalledWith(
        'current',
        expect.objectContaining({ page: 2, size: 50 })
      )
    })
  })

  it('renders current cutoff date in description', () => {
    render(<CurrentFuelCodes />, { wrapper })

    expect(
      screen.getByText('Current description after March 31, 2026')
    ).toBeInTheDocument()
  })

  it('renders API error message when archived bulletin fails', () => {
    mockUseFuelCodeBulletins.mockReturnValueOnce({
      data: { fuelCodes: [] },
      isLoading: false,
      isError: true,
      error: { message: 'Backend unavailable' }
    })

    render(<ArchivedFuelCodes />, { wrapper })

    expect(screen.getByText('Backend unavailable')).toBeInTheDocument()
  })
})
