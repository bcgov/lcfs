import { describe, expect, it } from 'vitest'
import { renewableFuelColumns } from '../_schema'
import { SUMMARY } from '@/constants/common'

const t = (key) => key

const createBaseSummaryData = () => {
  const rows = Array.from({ length: 11 }, (_, index) => ({
    line: index + 1,
    gasoline: 0,
    diesel: 0,
    jetFuel: 0
  }))

  rows[SUMMARY.LINE_1] = {
    ...rows[SUMMARY.LINE_1],
    gasoline: 2_000_000,
    diesel: 250_000,
    jetFuel: 0
  }

  rows[SUMMARY.LINE_2] = {
    ...rows[SUMMARY.LINE_2],
    gasoline: 1_000_000,
    diesel: 0,
    jetFuel: 0
  }

  rows[SUMMARY.LINE_4] = {
    ...rows[SUMMARY.LINE_4],
    gasoline: 150_000,
    diesel: 10_000,
    jetFuel: 0
  }

  return rows
}

describe('renewableFuelColumns line 7 behaviour', () => {
  it('omits max constraint for line 7 when no previous caps exist', () => {
    const summaryData = createBaseSummaryData()

    summaryData[SUMMARY.LINE_6] = {
      ...summaryData[SUMMARY.LINE_6],
      gasoline: 0,
      diesel: 0,
      jetFuel: 0
    }

    summaryData[SUMMARY.LINE_7] = {
      ...summaryData[SUMMARY.LINE_7],
      gasoline: 0,
      diesel: 0,
      jetFuel: 0,
      maxGasoline: 10_000,
      maxDiesel: 500,
      maxJetFuel: 250
    }

    const columns = renewableFuelColumns(
      t,
      summaryData,
      true,
      '2025',
      false
    )

    const gasolineColumn = columns.find((column) => column.id === 'gasoline')
    const dieselColumn = columns.find((column) => column.id === 'diesel')
    const jetFuelColumn = columns.find((column) => column.id === 'jetFuel')

    expect(gasolineColumn.editableCells).toContain(SUMMARY.LINE_7)
    expect(gasolineColumn.cellConstraints[SUMMARY.LINE_7]).not.toHaveProperty('max')
    expect(gasolineColumn.cellConstraints[SUMMARY.LINE_7].min).toBe(0)

    expect(dieselColumn.editableCells).toContain(SUMMARY.LINE_7)
    expect(dieselColumn.cellConstraints[SUMMARY.LINE_7]).not.toHaveProperty('max')
    expect(dieselColumn.cellConstraints[SUMMARY.LINE_7].min).toBe(0)

    expect(jetFuelColumn.cellConstraints[SUMMARY.LINE_7]).not.toHaveProperty('max')
    expect(jetFuelColumn.cellConstraints[SUMMARY.LINE_7].min).toBe(0)

    const expectedGasLine6Max = Math.round(0.05 * summaryData[SUMMARY.LINE_4].gasoline)
    const expectedDieselLine6Max = Math.round(0.05 * summaryData[SUMMARY.LINE_4].diesel)
    expect(gasolineColumn.cellConstraints[SUMMARY.LINE_6].max).toBe(expectedGasLine6Max)
    expect(gasolineColumn.cellConstraints[SUMMARY.LINE_8].max).toBe(expectedGasLine6Max)
    expect(dieselColumn.cellConstraints[SUMMARY.LINE_6].max).toBe(expectedDieselLine6Max)
    expect(dieselColumn.cellConstraints[SUMMARY.LINE_8].max).toBe(expectedDieselLine6Max)
  })

  it('locks line 7 editing and honours previous caps when prior year data exists', () => {
    const summaryData = createBaseSummaryData()

    summaryData[SUMMARY.LINE_6] = {
      ...summaryData[SUMMARY.LINE_6],
      gasoline: 7_500,
      diesel: 0,
      jetFuel: 0
    }

    summaryData[SUMMARY.LINE_7] = {
      ...summaryData[SUMMARY.LINE_7],
      gasoline: 5_000,
      diesel: 500,
      jetFuel: 0,
      maxGasoline: 5_000,
      maxDiesel: 500,
      maxJetFuel: 0
    }

    const columns = renewableFuelColumns(
      t,
      summaryData,
      true,
      '2026',
      true
    )

    const gasolineColumn = columns.find((column) => column.id === 'gasoline')
    const dieselColumn = columns.find((column) => column.id === 'diesel')

    expect(gasolineColumn.editableCells).not.toContain(SUMMARY.LINE_7)
    expect(gasolineColumn.cellConstraints[SUMMARY.LINE_7].max).toBe(5_000)
    expect(gasolineColumn.cellConstraints[SUMMARY.LINE_7].min).toBe(0)
    const expectedLine6Max = Math.round(0.05 * summaryData[SUMMARY.LINE_4].gasoline)
    expect(gasolineColumn.cellConstraints[SUMMARY.LINE_6].max).toBe(expectedLine6Max)
    expect(gasolineColumn.cellConstraints[SUMMARY.LINE_8].max).toBe(expectedLine6Max)
    expect(dieselColumn.cellConstraints[SUMMARY.LINE_7].max).toBe(500)
  })
})
