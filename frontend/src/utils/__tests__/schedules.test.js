import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleScheduleSave, handleScheduleDelete } from '../schedules'

// Mock uuid to predictable value
vi.mock('uuid', () => ({
  v4: () => 'mock-uuid'
}))

describe('handleScheduleSave', () => {
  const t = (key) => key // simple translator
  let alertRef
  let setErrors
  let setWarnings

  beforeEach(() => {
    alertRef = { current: { triggerAlert: vi.fn() } }
    setErrors = vi.fn()
    setWarnings = vi.fn()
  })

  it('returns success data when saveRow resolves', async () => {
    const saveRow = vi.fn().mockResolvedValue({ data: { foo: 'bar' } })
    const updated = { id: 1, foo: 'initial' }

    const result = await handleScheduleSave({
      labelPrefix: 'labels',
      idField: 'id',
      updatedData: updated,
      params: {},
      alertRef,
      setErrors,
      setWarnings,
      saveRow,
      t
    })

    expect(saveRow).toHaveBeenCalledWith(updated)
    expect(result.validationStatus).toBe('success')
    expect(result.modified).toBe(false)
    expect(alertRef.current.triggerAlert).toHaveBeenCalledWith({ message: 'Row updated successfully.', severity: 'success' })
  })

  it('handles warnings and errors when saveRow rejects with ERR_BAD_REQUEST', async () => {
    const apiMock = {
      forEachNode: (cb) => {
        // Provide fake row node
        cb({ data: { fuelSupplyId: 99 }, updateData: vi.fn() })
      }
    }
    const params = { node: { data: { id: 'temp' } }, api: apiMock }
    const errorResponse = {
      code: 'ERR_BAD_REQUEST',
      response: {
        data: {
          warnings: [{ id: 99, fields: ['baz'] }],
          errors: [{ fields: ['baz'], message: 'is invalid' }]
        }
      }
    }
    const saveRow = vi.fn().mockRejectedValue(errorResponse)

    const updated = { foo: 'bad' }

    const result = await handleScheduleSave({
      labelPrefix: 'labels',
      idField: 'id',
      updatedData: updated,
      params,
      alertRef,
      setErrors,
      setWarnings,
      saveRow,
      t
    })

    expect(result.validationStatus).toBe('warning')
    expect(setWarnings).toHaveBeenCalled()
    expect(alertRef.current.triggerAlert).toHaveBeenCalled()
  })
})

describe('handleScheduleDelete', () => {
  it('applies transaction and calls alert on successful delete', async () => {
    const alertRef = { current: { triggerAlert: vi.fn() } }
    const applyTransaction = vi.fn()
    const params = {
      node: { data: { id: 5, some: 'data' } },
      api: { applyTransaction, isRowDataEmpty: () => true }
    }

    const saveRow = vi.fn().mockResolvedValue({})
    const setRowData = vi.fn()
    const defaultRowData = { default: true }

    await handleScheduleDelete(
      params,
      'id',
      saveRow,
      alertRef,
      setRowData,
      defaultRowData
    )

    expect(applyTransaction).toHaveBeenCalled()
    expect(saveRow).toHaveBeenCalled()
    expect(alertRef.current.triggerAlert).toHaveBeenCalledWith({ message: 'Row deleted successfully.', severity: 'success' })
    expect(setRowData).toHaveBeenCalledWith([{ ...defaultRowData, id: 'mock-uuid' }])
  })
}) 