import { describe, it, expect, vi } from 'vitest'
import { finalSupplyEquipmentSummaryColDefs } from '../_schema'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

vi.mock('@/i18n', () => ({
  default: {
    t: (key) => key
  },
  t: (key) => key
}))

describe('FinalSupplyEquipment _schema', () => {
  const t = (key) => key

  it('adds status column first for IDIR users', () => {
    const colDefs = finalSupplyEquipmentSummaryColDefs(
      t,
      COMPLIANCE_REPORT_STATUSES.DRAFT,
      true
    )

    expect(colDefs[0].field).toBe('status')
    expect(colDefs[0].headerName).toBe(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.status'
    )
    expect(colDefs[0].cellRenderer).toBeDefined()
  })

  it('omits status column for non-IDIR users', () => {
    const colDefs = finalSupplyEquipmentSummaryColDefs(
      t,
      COMPLIANCE_REPORT_STATUSES.DRAFT,
      false
    )

    const fields = colDefs.map((col) => col.field)
    expect(fields).not.toContain('status')
    expect(colDefs[0].field).toBe('supplyDateRange')
  })
})
