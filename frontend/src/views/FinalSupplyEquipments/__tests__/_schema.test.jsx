import { describe, it, expect, vi } from 'vitest'
import {
  finalSupplyEquipmentSummaryColDefs,
  getFSEReportingColDefs
} from '../_schema'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

vi.mock('@/i18n', () => ({
  default: {
    t: (key) => key
  },
  t: (key) => key
}))

describe('FinalSupplyEquipment _schema', () => {
  const t = (key) => key

  it('adds status column first for IDIR users when report is submitted', () => {
    const colDefs = finalSupplyEquipmentSummaryColDefs(
      t,
      COMPLIANCE_REPORT_STATUSES.SUBMITTED,
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

  it('omits status column for IDIR users when report is not submitted', () => {
    const colDefs = finalSupplyEquipmentSummaryColDefs(
      t,
      COMPLIANCE_REPORT_STATUSES.ASSESSED,
      true
    )

    const fields = colDefs.map((col) => col.field)
    expect(fields).not.toContain('status')
    expect(colDefs[0].field).toBe('supplyDateRange')
  })

  it('shows ports and allocating organization after level in summary columns', () => {
    const colDefs = finalSupplyEquipmentSummaryColDefs(
      t,
      COMPLIANCE_REPORT_STATUSES.DRAFT,
      false
    )
    const fields = colDefs.map((col) => col.field)
    const levelIdx = fields.indexOf('levelOfEquipment')
    const portsIdx = fields.indexOf('ports')
    const allocatingIdx = fields.indexOf('allocatingOrganizationName')

    expect(levelIdx).toBeGreaterThan(-1)
    expect(portsIdx).toBe(levelIdx + 1)
    expect(allocatingIdx).toBe(levelIdx + 2)
  })

  it('shows ports and allocating organization after manufacturer in reporting columns', () => {
    const colDefs = getFSEReportingColDefs(
      '2025-01-01',
      '2025-12-31',
      {},
      {},
      1,
      'group-uuid'
    )
    const fields = colDefs.map((col) => col.field)
    const manufacturerIdx = fields.indexOf('manufacturer')
    const portsIdx = fields.indexOf('ports')
    const allocatingIdx = fields.indexOf('allocatingOrganizationName')

    expect(manufacturerIdx).toBeGreaterThan(-1)
    expect(portsIdx).toBe(manufacturerIdx + 1)
    expect(allocatingIdx).toBe(manufacturerIdx + 2)
  })
})
