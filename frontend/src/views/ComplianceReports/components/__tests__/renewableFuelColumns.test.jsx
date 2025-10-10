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

    // Line 6 (retention): Only when there's excess (renewable > required)
    // Gasoline: renewable=1,000,000, required=150,000 -> excess=850,000
    // Max = min(excess, 5% of Line 4) = min(850,000, 7,500) = 7,500
    const expectedGasLine6Max = Math.round(0.05 * summaryData[SUMMARY.LINE_4].gasoline)
    expect(gasolineColumn.cellConstraints[SUMMARY.LINE_6].max).toBe(expectedGasLine6Max)

    // Diesel: renewable=0, required=10,000 -> deficiency (not excess)
    // Since there's no excess, Line 6 max should be 0
    expect(dieselColumn.cellConstraints[SUMMARY.LINE_6].max).toBe(0)

    // Line 8 (deferral): Only when there's deficiency (renewable < required)
    // Gasoline has excess (not deficiency), so Line 8 max should be 0
    expect(gasolineColumn.cellConstraints[SUMMARY.LINE_8].max).toBe(0)

    // Diesel: renewable=0, required=10,000 -> deficiency=10,000
    // Max = min(deficiency, 5% of Line 4) = min(10,000, 500) = 500
    const expectedDieselLine8Max = Math.round(0.05 * summaryData[SUMMARY.LINE_4].diesel)
    expect(dieselColumn.cellConstraints[SUMMARY.LINE_8].max).toBe(expectedDieselLine8Max)
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

    // Line 6 (retention): Gasoline has excess (renewable=1,000,000 > required=150,000)
    // Max = min(excess, 5% of Line 4) = min(850,000, 7,500) = 7,500
    const expectedLine6Max = Math.round(0.05 * summaryData[SUMMARY.LINE_4].gasoline)
    expect(gasolineColumn.cellConstraints[SUMMARY.LINE_6].max).toBe(expectedLine6Max)

    // Line 8 (deferral): Gasoline has excess (not deficiency), so Line 8 max should be 0
    expect(gasolineColumn.cellConstraints[SUMMARY.LINE_8].max).toBe(0)

    expect(dieselColumn.cellConstraints[SUMMARY.LINE_7].max).toBe(500)
  })
})
