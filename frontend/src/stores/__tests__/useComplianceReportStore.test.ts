import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import useComplianceReportStore from '../useComplianceReportStore'

describe('useComplianceReportStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useComplianceReportStore.setState({
        currentReport: null,
        reportCache: new Map()
      })
    })
  })

  describe('initial state', () => {
    it('should initialize with null currentReport', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      
      expect(result.current.currentReport).toBeNull()
    })

    it('should initialize with empty reportCache Map', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      
      expect(result.current.reportCache).toBeInstanceOf(Map)
      expect(result.current.reportCache.size).toBe(0)
    })

    it('should have all required functions available', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      
      expect(typeof result.current.setCurrentReport).toBe('function')
      expect(typeof result.current.cacheReport).toBe('function')
      expect(typeof result.current.getCachedReport).toBe('function')
      expect(typeof result.current.shouldFetchReport).toBe('function')
      expect(typeof result.current.clearCurrentReport).toBe('function')
      expect(typeof result.current.removeReport).toBe('function')
      expect(typeof result.current.getCurrentReportId).toBe('function')
      expect(typeof result.current.isReportCached).toBe('function')
      expect(typeof result.current.getAllCachedReports).toBe('function')
      expect(typeof result.current.getReportByIdOrCurrent).toBe('function')
    })
  })

  describe('setCurrentReport functionality', () => {
    it('should set current report when setCurrentReport is called', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const mockReport = {
        report: { id: 1, title: 'Test Report', status: 'DRAFT' },
        metadata: { createdAt: '2023-01-01' }
      }

      act(() => {
        result.current.setCurrentReport(mockReport)
      })

      expect(result.current.currentReport).toEqual(mockReport)
    })

    it('should overwrite existing current report', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const firstReport = {
        report: { id: 1, title: 'First Report', status: 'DRAFT' }
      }
      const secondReport = {
        report: { id: 2, title: 'Second Report', status: 'SUBMITTED' }
      }

      act(() => {
        result.current.setCurrentReport(firstReport)
      })
      expect(result.current.currentReport).toEqual(firstReport)

      act(() => {
        result.current.setCurrentReport(secondReport)
      })
      expect(result.current.currentReport).toEqual(secondReport)
    })

    it('should handle setting current report to null', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const mockReport = {
        report: { id: 1, title: 'Test Report' }
      }

      act(() => {
        result.current.setCurrentReport(mockReport)
      })
      expect(result.current.currentReport).toEqual(mockReport)

      act(() => {
        result.current.setCurrentReport(null)
      })
      expect(result.current.currentReport).toBeNull()
    })
  })

  describe('clearCurrentReport functionality', () => {
    it('should clear current report', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const mockReport = {
        report: { id: 1, title: 'Test Report' }
      }

      act(() => {
        result.current.setCurrentReport(mockReport)
      })
      expect(result.current.currentReport).toEqual(mockReport)

      act(() => {
        result.current.clearCurrentReport()
      })
      expect(result.current.currentReport).toBeNull()
    })

    it('should be safe to call when current report is already null', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      
      expect(result.current.currentReport).toBeNull()

      act(() => {
        result.current.clearCurrentReport()
      })
      expect(result.current.currentReport).toBeNull()
    })
  })

  describe('cacheReport functionality', () => {
    it('should cache a report by ID', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const reportId = 1
      const reportData = {
        report: { id: reportId, title: 'Cached Report', status: 'DRAFT' }
      }

      act(() => {
        result.current.cacheReport(reportId, reportData)
      })

      expect(result.current.reportCache.has(reportId)).toBe(true)
      expect(result.current.reportCache.get(reportId)).toEqual(reportData)
    })

    it('should overwrite existing cached report with same ID', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const reportId = 1
      const firstReport = {
        report: { id: reportId, title: 'First Report', status: 'DRAFT' }
      }
      const updatedReport = {
        report: { id: reportId, title: 'Updated Report', status: 'SUBMITTED' }
      }

      act(() => {
        result.current.cacheReport(reportId, firstReport)
      })
      expect(result.current.reportCache.get(reportId)).toEqual(firstReport)

      act(() => {
        result.current.cacheReport(reportId, updatedReport)
      })
      expect(result.current.reportCache.get(reportId)).toEqual(updatedReport)
    })

    it('should cache multiple different reports', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const report1 = { report: { id: 1, title: 'Report 1' } }
      const report2 = { report: { id: 2, title: 'Report 2' } }
      const report3 = { report: { id: 3, title: 'Report 3' } }

      act(() => {
        result.current.cacheReport(1, report1)
        result.current.cacheReport(2, report2)
        result.current.cacheReport(3, report3)
      })

      expect(result.current.reportCache.size).toBe(3)
      expect(result.current.reportCache.get(1)).toEqual(report1)
      expect(result.current.reportCache.get(2)).toEqual(report2)
      expect(result.current.reportCache.get(3)).toEqual(report3)
    })
  })

  describe('getCachedReport functionality', () => {
    it('should return cached report by ID', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const reportId = 1
      const reportData = {
        report: { id: reportId, title: 'Cached Report' }
      }

      act(() => {
        result.current.cacheReport(reportId, reportData)
      })

      const retrieved = result.current.getCachedReport(reportId)
      expect(retrieved).toEqual(reportData)
    })

    it('should return undefined for non-existent report ID', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      
      const retrieved = result.current.getCachedReport(999)
      expect(retrieved).toBeUndefined()
    })
  })

  describe('shouldFetchReport functionality', () => {
    it('should return true for non-cached report', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      
      expect(result.current.shouldFetchReport(1)).toBe(true)
    })

    it('should return false for cached report', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const reportId = 1
      const reportData = {
        report: { id: reportId, title: 'Cached Report' }
      }

      act(() => {
        result.current.cacheReport(reportId, reportData)
      })

      expect(result.current.shouldFetchReport(reportId)).toBe(false)
    })
  })

  describe('isReportCached functionality', () => {
    it('should return true for cached report', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const reportId = 1
      const reportData = {
        report: { id: reportId, title: 'Cached Report' }
      }

      act(() => {
        result.current.cacheReport(reportId, reportData)
      })

      expect(result.current.isReportCached(reportId)).toBe(true)
    })

    it('should return false for non-cached report', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      
      expect(result.current.isReportCached(999)).toBe(false)
    })
  })

  describe('removeReport functionality', () => {
    it('should remove report from cache', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const reportId = 1
      const reportData = {
        report: { id: reportId, title: 'Report to Remove' }
      }

      act(() => {
        result.current.cacheReport(reportId, reportData)
      })
      expect(result.current.isReportCached(reportId)).toBe(true)

      act(() => {
        result.current.removeReport(reportId)
      })
      expect(result.current.isReportCached(reportId)).toBe(false)
    })

    it('should clear current report if it matches the removed report ID', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const reportId = 1
      const reportData = {
        report: { id: reportId, title: 'Current Report' }
      }

      act(() => {
        result.current.setCurrentReport(reportData)
        result.current.cacheReport(reportId, reportData)
      })
      
      expect(result.current.currentReport).toEqual(reportData)
      expect(result.current.isReportCached(reportId)).toBe(true)

      act(() => {
        result.current.removeReport(reportId)
      })

      expect(result.current.currentReport).toBeNull()
      expect(result.current.isReportCached(reportId)).toBe(false)
    })

    it('should not clear current report if it does not match the removed report ID', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const currentReportId = 1
      const removeReportId = 2
      const currentReportData = {
        report: { id: currentReportId, title: 'Current Report' }
      }
      const removeReportData = {
        report: { id: removeReportId, title: 'Report to Remove' }
      }

      act(() => {
        result.current.setCurrentReport(currentReportData)
        result.current.cacheReport(currentReportId, currentReportData)
        result.current.cacheReport(removeReportId, removeReportData)
      })

      act(() => {
        result.current.removeReport(removeReportId)
      })

      expect(result.current.currentReport).toEqual(currentReportData)
      expect(result.current.isReportCached(currentReportId)).toBe(true)
      expect(result.current.isReportCached(removeReportId)).toBe(false)
    })

    it('should handle removing non-existent report gracefully', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      
      // Should not throw an error
      act(() => {
        result.current.removeReport(999)
      })

      expect(result.current.reportCache.size).toBe(0)
    })
  })

  describe('getCurrentReportId functionality', () => {
    it('should return current report ID when current report exists', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const reportId = 1
      const reportData = {
        report: { id: reportId, title: 'Current Report' }
      }

      act(() => {
        result.current.setCurrentReport(reportData)
      })

      expect(result.current.getCurrentReportId()).toBe(reportId)
    })

    it('should return undefined when no current report', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      
      expect(result.current.getCurrentReportId()).toBeUndefined()
    })

    it('should return undefined when current report has no ID', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const reportData = {
        report: { title: 'Report without ID' }
      }

      act(() => {
        result.current.setCurrentReport(reportData)
      })

      expect(result.current.getCurrentReportId()).toBeUndefined()
    })
  })

  describe('getAllCachedReports functionality', () => {
    it('should return empty array when no reports cached', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      
      expect(result.current.getAllCachedReports()).toEqual([])
    })

    it('should return all cached reports as array', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const report1 = { report: { id: 1, title: 'Report 1' } }
      const report2 = { report: { id: 2, title: 'Report 2' } }
      const report3 = { report: { id: 3, title: 'Report 3' } }

      act(() => {
        result.current.cacheReport(1, report1)
        result.current.cacheReport(2, report2)
        result.current.cacheReport(3, report3)
      })

      const allReports = result.current.getAllCachedReports()
      expect(allReports).toHaveLength(3)
      expect(allReports).toContain(report1)
      expect(allReports).toContain(report2)
      expect(allReports).toContain(report3)
    })
  })

  describe('getReportByIdOrCurrent functionality', () => {
    it('should return cached report when available', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const reportId = 1
      const cachedReport = {
        report: { id: reportId, title: 'Cached Report' }
      }

      act(() => {
        result.current.cacheReport(reportId, cachedReport)
      })

      const retrieved = result.current.getReportByIdOrCurrent(reportId)
      expect(retrieved).toEqual(cachedReport)
    })

    it('should return current report when requested ID matches current report ID', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const reportId = 1
      const currentReport = {
        report: { id: reportId, title: 'Current Report' }
      }

      act(() => {
        result.current.setCurrentReport(currentReport)
      })

      const retrieved = result.current.getReportByIdOrCurrent(reportId)
      expect(retrieved).toEqual(currentReport)
    })

    it('should prefer cached report over current report when both exist', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const reportId = 1
      const cachedReport = {
        report: { id: reportId, title: 'Cached Report' }
      }
      const currentReport = {
        report: { id: reportId, title: 'Current Report' }
      }

      act(() => {
        result.current.setCurrentReport(currentReport)
        result.current.cacheReport(reportId, cachedReport)
      })

      const retrieved = result.current.getReportByIdOrCurrent(reportId)
      expect(retrieved).toEqual(cachedReport)
    })

    it('should return null when report is not cached and not current', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      
      const retrieved = result.current.getReportByIdOrCurrent(999)
      expect(retrieved).toBeNull()
    })

    it('should return null when current report exists but has different ID', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const currentReport = {
        report: { id: 1, title: 'Current Report' }
      }

      act(() => {
        result.current.setCurrentReport(currentReport)
      })

      const retrieved = result.current.getReportByIdOrCurrent(2)
      expect(retrieved).toBeNull()
    })
  })

  describe('store reactivity and integration', () => {
    it('should trigger re-renders when state changes', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const reportData = {
        report: { id: 1, title: 'Test Report' }
      }

      expect(result.current.currentReport).toBeNull()

      act(() => {
        result.current.setCurrentReport(reportData)
      })

      expect(result.current.currentReport).toEqual(reportData)
    })

    it('should maintain cache integrity across multiple operations', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const report1 = { report: { id: 1, title: 'Report 1' } }
      const report2 = { report: { id: 2, title: 'Report 2' } }
      const report3 = { report: { id: 3, title: 'Report 3' } }

      act(() => {
        // Cache multiple reports
        result.current.cacheReport(1, report1)
        result.current.cacheReport(2, report2)
        result.current.cacheReport(3, report3)
        
        // Set current report
        result.current.setCurrentReport(report2)
        
        // Remove one report
        result.current.removeReport(3)
      })

      expect(result.current.reportCache.size).toBe(2)
      expect(result.current.isReportCached(1)).toBe(true)
      expect(result.current.isReportCached(2)).toBe(true)
      expect(result.current.isReportCached(3)).toBe(false)
      expect(result.current.currentReport).toEqual(report2)
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle reports with complex nested data', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      const complexReport = {
        report: {
          id: 1,
          title: 'Complex Report',
          metadata: {
            createdBy: { id: 1, name: 'User' },
            tags: ['urgent', 'quarterly'],
            settings: {
              notifications: true,
              autoSave: false
            }
          },
          data: {
            sections: [
              { id: 'section1', fields: [{ name: 'field1', value: 'test' }] },
              { id: 'section2', fields: [{ name: 'field2', value: 123 }] }
            ]
          }
        }
      }

      act(() => {
        result.current.setCurrentReport(complexReport)
        result.current.cacheReport(1, complexReport)
      })

      expect(result.current.currentReport).toEqual(complexReport)
      expect(result.current.getCachedReport(1)).toEqual(complexReport)
    })

    it('should handle rapid cache operations', () => {
      const { result } = renderHook(() => useComplianceReportStore())
      
      act(() => {
        // Rapidly cache and remove reports
        for (let i = 1; i <= 10; i++) {
          const report = { report: { id: i, title: `Report ${i}` } }
          result.current.cacheReport(i, report)
        }
        
        for (let i = 1; i <= 5; i++) {
          result.current.removeReport(i)
        }
      })

      expect(result.current.reportCache.size).toBe(5)
      for (let i = 6; i <= 10; i++) {
        expect(result.current.isReportCached(i)).toBe(true)
      }
    })

    it('should handle null and undefined values gracefully', () => {
      const { result } = renderHook(() => useComplianceReportStore())

      act(() => {
        result.current.setCurrentReport(undefined)
      })
      expect(result.current.currentReport).toBeUndefined()

      act(() => {
        result.current.cacheReport(1, null)
      })
      expect(result.current.getCachedReport(1)).toBeNull()

      act(() => {
        result.current.cacheReport(2, undefined)
      })
      expect(result.current.getCachedReport(2)).toBeUndefined()
    })
  })
})