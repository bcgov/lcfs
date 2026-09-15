import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'

import { GeneratedFuelCodesSection } from '@/views/CarbonIntensity/components/GeneratedFuelCodesSection'

const mockUpdateGeneratedFuelCode = vi.fn()
const mockGridEditor = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('@/hooks/useFuelCode', () => ({
  useFuelCodeOptions: () => ({
    data: {
      fuelCodePrefixes: [],
      fuelTypes: [],
      fieldOptions: {
        feedstock: [],
        feedstockLocation: [],
        feedstockMisc: [],
        formerCompany: []
      }
    }
  })
}))

vi.mock('@/hooks/useCIApplication', () => ({
  useUpdateCIApplicationGeneratedFuelCode: () => ({
    mutateAsync: mockUpdateGeneratedFuelCode
  })
}))

vi.mock('@/components/BCDataGrid/BCGridEditor', () => ({
  BCGridEditor: (props) => {
    mockGridEditor(props)
    return <div data-test="generated-fuel-code-grid" />
  }
}))

describe('GeneratedFuelCodesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes server validation errors into the grid context on initial load', () => {
    render(
      <GeneratedFuelCodesSection
        ciApplication={{
          ciApplicationId: 10,
          generatedFuelCodes: [
            {
              id: 'generated-1',
              prefix: 'BCLCF',
              validationErrors: {
                approvalDate: 'Required.',
                edrms: 'Required.'
              },
              validationMsg: 'Fuel code row still has missing required fields.',
              isValid: false
            }
          ]
        }}
      />
    )

    expect(screen.getByTestId('generated-fuel-code-grid')).toBeInTheDocument()
    expect(mockGridEditor).toHaveBeenCalled()
    expect(mockGridEditor.mock.calls.at(-1)[0].context.errors).toEqual({
      'generated-1': ['approvalDate', 'edrms']
    })
    expect(mockGridEditor.mock.calls.at(-1)[0].rowData[0]).toMatchObject({
      validationStatus: 'error',
      validationErrors: {
        approvalDate: 'Required.',
        edrms: 'Required.'
      }
    })
    expect(
      mockGridEditor.mock.calls.at(-1)[0].defaultColDef.cellStyle({
        data: mockGridEditor.mock.calls.at(-1)[0].rowData[0],
        colDef: { field: 'approvalDate' }
      })
    ).toEqual({ borderColor: 'red' })
  })

  it('handles rows without validation errors on initial load', () => {
    render(
      <GeneratedFuelCodesSection
        ciApplication={{
          ciApplicationId: 10,
          generatedFuelCodes: [
            {
              id: 'generated-valid',
              prefix: 'BCLCF',
              validationErrors: null,
              validationMsg: null,
              isValid: true
            }
          ]
        }}
      />
    )

    expect(screen.getByTestId('generated-fuel-code-grid')).toBeInTheDocument()
    expect(mockGridEditor.mock.calls.at(-1)[0].context.errors).toEqual({})
    expect(mockGridEditor.mock.calls.at(-1)[0].rowData[0]).toMatchObject({
      validationStatus: 'success'
    })
  })

  it('preserves unsaved generated fuel code edits when application data refreshes', () => {
    const { rerender } = render(
      <GeneratedFuelCodesSection
        ciApplication={{
          ciApplicationId: 10,
          generatedFuelCodes: [
            {
              id: 'generated-1',
              prefix: 'BCLCF',
              feedstockFuelTransportMode: [],
              finishedFuelTransportMode: []
            },
            {
              id: 'generated-2',
              prefix: 'BCLCF',
              feedstockFuelTransportMode: [],
              finishedFuelTransportMode: []
            }
          ]
        }}
      />
    )

    const gridProps = mockGridEditor.mock.calls.at(-1)[0]
    const editedRow2 = {
      ...gridProps.rowData[1],
      feedstockFuelTransportMode: [{ transportMode: 'Truck', distance: 100 }],
      finishedFuelTransportMode: [{ transportMode: 'Rail', distance: 200 }]
    }

    act(() => {
      gridProps.onCellValueChanged({
        data: editedRow2,
        oldValue: [],
        newValue: editedRow2.finishedFuelTransportMode,
        api: { applyTransaction: vi.fn() }
      })
    })

    rerender(
      <GeneratedFuelCodesSection
        ciApplication={{
          ciApplicationId: 10,
          generatedFuelCodes: [
            {
              id: 'generated-1',
              prefix: 'BCLCF',
              feedstockFuelTransportMode: [
                { transportMode: 'Truck', distance: 50 }
              ],
              finishedFuelTransportMode: [
                { transportMode: 'Rail', distance: 75 }
              ]
            },
            {
              id: 'generated-2',
              prefix: 'BCLCF',
              feedstockFuelTransportMode: [],
              finishedFuelTransportMode: []
            }
          ]
        }}
      />
    )

    expect(mockGridEditor.mock.calls.at(-1)[0].rowData[1]).toMatchObject({
      id: 'generated-2',
      modified: true,
      feedstockFuelTransportMode: [{ transportMode: 'Truck', distance: 100 }],
      finishedFuelTransportMode: [{ transportMode: 'Rail', distance: 200 }]
    })
    expect(mockGridEditor.mock.calls.at(-1)[0].rowData[0]).toMatchObject({
      id: 'generated-1',
      feedstockFuelTransportMode: [{ transportMode: 'Truck', distance: 50 }],
      finishedFuelTransportMode: [{ transportMode: 'Rail', distance: 75 }]
    })
  })
})
