import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ProposedFuelPathwaysStep } from '@/views/CarbonIntensity/components/ProposedFuelPathwaysStep'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

// BCGridEditor pulls in AG Grid which is heavy and not relevant to this
// component's contract. Stub it out so we can drive its callbacks
// directly from the test.
let lastGridProps = null
vi.mock('@/components/BCDataGrid/BCGridEditor', () => ({
  BCGridEditor: (props) => {
    lastGridProps = props
    if (props.gridRef) {
      props.gridRef.current = {
        api: {
          forEachNode: (cb) =>
            (props.rowData || []).forEach((data) => cb({ data })),
          applyTransaction: vi.fn(),
          refreshCells: vi.fn()
        }
      }
    }
    return <div data-test="grid-stub" />
  }
}))

const optionsData = {
  pathwayApplicationTypes: [
    { pathwayApplicationTypeId: 1, type: 'New' },
    { pathwayApplicationTypeId: 2, type: 'Renewal' }
  ],
  pathwayFuelCodeTypes: [
    { pathwayFuelCodeTypeId: 1, type: '1-year provisional' }
  ],
  fuelTypes: [{ fuelTypeId: 1, fuelType: 'Biodiesel' }],
  transportModes: ['Truck', 'Rail'],
  fuelCodes: [
    {
      fuelCodeId: 42,
      fuelCode: 'C-BCLCF100.4',
      carbonIntensity: 23.23,
      fuelTypeId: 1,
      fuelType: 'Biodiesel',
      feedstock: 'Corn',
      feedstockLocation: 'Ontario'
    }
  ]
}

const baseCi = {
  ciApplicationId: 99,
  pathways: [],
  pathwayDescription: ''
}

describe('ProposedFuelPathwaysStep', () => {
  beforeEach(() => {
    lastGridProps = null
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  it('renders the grid, description, and action buttons', () => {
    render(
      <ProposedFuelPathwaysStep
        ciApplication={baseCi}
        optionsData={optionsData}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
      { wrapper }
    )
    expect(screen.getByTestId('grid-stub')).toBeInTheDocument()
    expect(screen.getByTestId('pathwayDescription')).toBeInTheDocument()
    expect(screen.getByTestId('ci-step2-save-btn')).toBeInTheDocument()
    expect(screen.getByTestId('ci-step2-delete-btn')).toBeInTheDocument()
  })

  it('blocks save and surfaces validation errors when rows are incomplete', async () => {
    const onSave = vi.fn()
    render(
      <ProposedFuelPathwaysStep
        ciApplication={baseCi}
        optionsData={optionsData}
        onSave={onSave}
      />,
      { wrapper }
    )
    fireEvent.click(screen.getByTestId('ci-step2-save-btn'))
    await waitFor(() => expect(onSave).not.toHaveBeenCalled())
  })

  it('submits a valid payload when all required fields are present', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const ciWithCompleteRow = {
      ...baseCi,
      pathways: [
        {
          pathwayId: 1,
          applicationTypeId: 1,
          fuelCodeTypeId: 1,
          operatingDataFrom: '2025-01-01',
          operatingDataTo: '2025-12-31',
          fuelCodeId: null,
          proposedCi: 5.61,
          fuelTypeId: 1,
          feedstock: 'Canola',
          feedstockRegion: 'Saskatchewan',
          feedstockTransportMode: 'Truck',
          feedstockTransportDistance: 100,
          coproducts: null,
          finishedFuelTransportMode: 'Rail',
          finishedFuelTransportDistance: 200
        }
      ],
      pathwayDescription: 'Uses CCS'
    }
    render(
      <ProposedFuelPathwaysStep
        ciApplication={ciWithCompleteRow}
        optionsData={optionsData}
        onSave={onSave}
      />,
      { wrapper }
    )

    fireEvent.click(screen.getByTestId('ci-step2-save-btn'))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const payload = onSave.mock.calls[0][0]
    expect(payload.pathways).toHaveLength(1)
    expect(payload.pathways[0].applicationTypeId).toBe(1)
    expect(payload.pathwayDescription).toBe('Uses CCS')
  })

  it('rejects a Renewal row that is missing the fuel code iteration', async () => {
    const onSave = vi.fn()
    const renewalMissingFuelCode = {
      ...baseCi,
      pathways: [
        {
          pathwayId: 2,
          applicationTypeId: 2,
          fuelCodeTypeId: 1,
          operatingDataFrom: '2025-01-01',
          operatingDataTo: '2025-12-31',
          fuelCodeId: null,
          proposedCi: 23.23,
          fuelTypeId: 1,
          feedstock: 'Corn',
          feedstockRegion: 'Ontario',
          feedstockTransportMode: 'Truck',
          feedstockTransportDistance: 50,
          coproducts: null,
          finishedFuelTransportMode: 'Rail',
          finishedFuelTransportDistance: 75
        }
      ]
    }
    render(
      <ProposedFuelPathwaysStep
        ciApplication={renewalMissingFuelCode}
        optionsData={optionsData}
        onSave={onSave}
      />,
      { wrapper }
    )
    fireEvent.click(screen.getByTestId('ci-step2-save-btn'))
    await waitFor(() => expect(onSave).not.toHaveBeenCalled())
  })
})
