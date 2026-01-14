import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useUserStore, type User } from '../useUserStore'
import {
  useLoadingStore,
  type LoadingDetails,
  type LoadingState
} from '../useLoadingStore'
import useComplianceReportStore, {
  type ComplianceReport
} from '../useComplianceReportStore'

const getUser = (user: User | null): User => {
  if (!user) {
    throw new Error('Expected user to be set')
  }
  return user
}

const getReport = (report: ComplianceReport | null): ComplianceReport => {
  if (!report) {
    throw new Error('Expected report to be set')
  }
  return report
}

const getCachedReport = (
  report: ComplianceReport | undefined
): ComplianceReport => {
  if (!report) {
    throw new Error('Expected cached report to be set')
  }
  return report
}

const getLoadingDetails = (loading: LoadingState): LoadingDetails => {
  if (typeof loading === 'boolean') {
    throw new Error('Expected loading details object')
  }
  return loading
}

describe('Store Integration Tests', () => {
  beforeEach(() => {
    // Reset all stores before each test
    act(() => {
      useUserStore.setState({ user: null })
      useLoadingStore.setState({ loading: false })
      useComplianceReportStore.setState({
        currentReport: null,
        reportCache: new Map()
      })
    })
  })

  describe('User and Loading Store Integration', () => {
    it('should coordinate user login with loading states', () => {
      const userHook = renderHook(() => useUserStore())
      const loadingHook = renderHook(() => useLoadingStore())
      
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'ANALYST'
      }

      // Simulate login flow
      act(() => {
        // Start loading during login
        loadingHook.result.current.setLoading(true)
        
        // Set user after "authentication"
        userHook.result.current.setUser(mockUser)
        
        // Stop loading after login complete
        loadingHook.result.current.setLoading(false)
      })

      expect(userHook.result.current.user).toEqual(mockUser)
      expect(loadingHook.result.current.loading).toBe(false)
    })

    it('should handle logout flow with loading coordination', () => {
      const userHook = renderHook(() => useUserStore())
      const loadingHook = renderHook(() => useLoadingStore())
      
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'ANALYST'
      }

      // Set initial logged-in state
      act(() => {
        userHook.result.current.setUser(mockUser)
      })

      // Simulate logout flow
      act(() => {
        // Start loading during logout
        loadingHook.result.current.setLoading(true)
        
        // Clear user
        userHook.result.current.setUser(null)
        
        // Stop loading after logout complete
        loadingHook.result.current.setLoading(false)
      })

      expect(userHook.result.current.user).toBeNull()
      expect(loadingHook.result.current.loading).toBe(false)
    })
  })

  describe('User and Compliance Report Store Integration', () => {
    it('should associate current user with report operations', () => {
      const userHook = renderHook(() => useUserStore())
      const reportHook = renderHook(() => useComplianceReportStore())
      
      const mockUser = {
        id: 1,
        name: 'Report Author',
        email: 'author@example.com',
        role: 'ANALYST'
      }
      
      const mockReport = {
        report: {
          id: 1,
          title: 'User Report',
          authorId: mockUser.id,
          status: 'DRAFT'
        },
        metadata: {
          createdBy: mockUser.id,
          lastModifiedBy: mockUser.id
        }
      }

      act(() => {
        // Set current user
        userHook.result.current.setUser(mockUser)
        
        // Set report associated with user
        reportHook.result.current.setCurrentReport(mockReport)
        reportHook.result.current.cacheReport(1, mockReport)
      })

      const storedUser = getUser(userHook.result.current.user)
      expect(storedUser.id).toBe(mockUser.id)

      const currentReport = getReport(reportHook.result.current.currentReport)
      expect(currentReport.report.authorId).toBe(mockUser.id)

      const cachedReport = getCachedReport(
        reportHook.result.current.getCachedReport(1)
      )
      expect(cachedReport.metadata?.createdBy).toBe(mockUser.id)
    })

    it('should handle user switching with report context preservation', () => {
      const userHook = renderHook(() => useUserStore())
      const reportHook = renderHook(() => useComplianceReportStore())
      
      const user1 = { id: 1, name: 'User 1', role: 'ANALYST' }
      const user2 = { id: 2, name: 'User 2', role: 'GOVERNMENT' }
      
      const report1 = {
        report: { id: 1, title: 'Report 1', authorId: user1.id }
      }
      const report2 = {
        report: { id: 2, title: 'Report 2', authorId: user2.id }
      }

      // User 1 session
      act(() => {
        userHook.result.current.setUser(user1)
        reportHook.result.current.setCurrentReport(report1)
        reportHook.result.current.cacheReport(1, report1)
      })

      expect(reportHook.result.current.getCurrentReportId()).toBe(1)

      // Switch to User 2
      act(() => {
        userHook.result.current.setUser(user2)
        reportHook.result.current.setCurrentReport(report2)
        reportHook.result.current.cacheReport(2, report2)
      })

      // Both reports should be cached but current should be user 2's report
      const storedUser = getUser(userHook.result.current.user)
      expect(storedUser.id).toBe(2)
      expect(reportHook.result.current.getCurrentReportId()).toBe(2)
      expect(reportHook.result.current.isReportCached(1)).toBe(true)
      expect(reportHook.result.current.isReportCached(2)).toBe(true)
    })
  })

  describe('Loading and Compliance Report Store Integration', () => {
    it('should coordinate loading states with report operations', () => {
      const loadingHook = renderHook(() => useLoadingStore())
      const reportHook = renderHook(() => useComplianceReportStore())
      
      const mockReport = {
        report: { id: 1, title: 'Loading Report', status: 'DRAFT' }
      }

      // Simulate report loading flow
      act(() => {
        // Start loading
        loadingHook.result.current.setLoading(true)
      })

      expect(loadingHook.result.current.loading).toBe(true)
      expect(reportHook.result.current.currentReport).toBeNull()

      act(() => {
        // "Fetch" and set report
        reportHook.result.current.setCurrentReport(mockReport)
        reportHook.result.current.cacheReport(1, mockReport)
        
        // Stop loading
        loadingHook.result.current.setLoading(false)
      })

      expect(loadingHook.result.current.loading).toBe(false)
      expect(reportHook.result.current.currentReport).toEqual(mockReport)
      expect(reportHook.result.current.isReportCached(1)).toBe(true)
    })

    it('should handle complex loading states for multiple report operations', () => {
      const loadingHook = renderHook(() => useLoadingStore())
      const reportHook = renderHook(() => useComplianceReportStore())
      
      const reports = [
        { report: { id: 1, title: 'Report 1' } },
        { report: { id: 2, title: 'Report 2' } },
        { report: { id: 3, title: 'Report 3' } }
      ]

      // Simulate batch loading
      act(() => {
        loadingHook.result.current.setLoading({
          isLoading: true,
          operations: ['fetchReport1', 'fetchReport2', 'fetchReport3'],
          completed: 0,
          total: 3
        })
      })

      // Load reports one by one
      reports.forEach((report, index) => {
        act(() => {
          reportHook.result.current.cacheReport(report.report.id, report)
          
          // Update loading progress
          loadingHook.result.current.setLoading({
            isLoading: index < 2,
            operations: ['fetchReport1', 'fetchReport2', 'fetchReport3'],
            completed: index + 1,
            total: 3
          })
        })
      })

      // All reports should be cached and loading should be complete
      const loadingDetails = getLoadingDetails(
        loadingHook.result.current.loading
      )
      expect(loadingDetails.isLoading).toBe(false)
      expect(loadingDetails.completed).toBe(3)
      expect(reportHook.result.current.reportCache.size).toBe(3)
      reports.forEach(report => {
        expect(reportHook.result.current.isReportCached(report.report.id)).toBe(true)
      })
    })
  })

  describe('All Three Stores Integration', () => {
    it('should coordinate user authentication, loading, and report access', () => {
      const userHook = renderHook(() => useUserStore())
      const loadingHook = renderHook(() => useLoadingStore())
      const reportHook = renderHook(() => useComplianceReportStore())
      
      const mockUser = {
        id: 1,
        name: 'Integrated User',
        email: 'integrated@example.com',
        role: 'ANALYST'
      }
      
      const userReports = [
        { report: { id: 1, title: 'User Report 1', authorId: 1 } },
        { report: { id: 2, title: 'User Report 2', authorId: 1 } }
      ]

      // Simulate complete application flow
      act(() => {
        // Start authentication loading
        loadingHook.result.current.setLoading(true)
      })

      act(() => {
        // Complete authentication
        userHook.result.current.setUser(mockUser)
        loadingHook.result.current.setLoading(false)
      })

      expect(userHook.result.current.user).toEqual(mockUser)
      expect(loadingHook.result.current.loading).toBe(false)

      act(() => {
        // Start loading user's reports
        loadingHook.result.current.setLoading(true)
      })

      act(() => {
        // Load user's reports
        userReports.forEach(report => {
          reportHook.result.current.cacheReport(report.report.id, report)
        })
        
        // Set first report as current
        reportHook.result.current.setCurrentReport(userReports[0])
        
        // Stop loading
        loadingHook.result.current.setLoading(false)
      })

      // Verify final state
      const storedUser = getUser(userHook.result.current.user)
      expect(storedUser.id).toBe(1)
      expect(loadingHook.result.current.loading).toBe(false)
      expect(reportHook.result.current.getCurrentReportId()).toBe(1)
      expect(reportHook.result.current.reportCache.size).toBe(2)
      
      // Verify user owns the reports
      userReports.forEach(report => {
        const cachedReport = getCachedReport(
          reportHook.result.current.getCachedReport(report.report.id)
        )
        expect(cachedReport.report.authorId).toBe(mockUser.id)
      })
    })

    it('should handle logout flow with cleanup of all stores', () => {
      const userHook = renderHook(() => useUserStore())
      const loadingHook = renderHook(() => useLoadingStore())
      const reportHook = renderHook(() => useComplianceReportStore())
      
      // Set up authenticated state with reports
      const mockUser = { id: 1, name: 'Test User', role: 'ANALYST' }
      const mockReport = { report: { id: 1, title: 'User Report' } }

      act(() => {
        userHook.result.current.setUser(mockUser)
        reportHook.result.current.setCurrentReport(mockReport)
        reportHook.result.current.cacheReport(1, mockReport)
      })

      // Simulate logout with cleanup
      act(() => {
        // Start logout loading
        loadingHook.result.current.setLoading(true)
        
        // Clear user
        userHook.result.current.setUser(null)
        
        // Clear current report (but keep cache for demo)
        reportHook.result.current.clearCurrentReport()
        
        // Complete logout
        loadingHook.result.current.setLoading(false)
      })

      expect(userHook.result.current.user).toBeNull()
      expect(loadingHook.result.current.loading).toBe(false)
      expect(reportHook.result.current.currentReport).toBeNull()
      // Cache might be preserved depending on business logic
      expect(reportHook.result.current.isReportCached(1)).toBe(true)
    })

    it('should handle error states across all stores', () => {
      const userHook = renderHook(() => useUserStore())
      const loadingHook = renderHook(() => useLoadingStore())
      const reportHook = renderHook(() => useComplianceReportStore())

      // Simulate error during report loading
      act(() => {
        // Set user first
        userHook.result.current.setUser({ id: 1, name: 'User' })
        
        // Start loading reports
        loadingHook.result.current.setLoading(true)
      })

      act(() => {
        // Simulate error - stop loading but don't set reports
        loadingHook.result.current.setLoading({
          isLoading: false,
          error: 'Failed to load reports',
          hasError: true
        })
      })

      expect(userHook.result.current.user).toBeTruthy()
      const loadingDetails = getLoadingDetails(
        loadingHook.result.current.loading
      )
      expect(loadingDetails.hasError).toBe(true)
      expect(reportHook.result.current.currentReport).toBeNull()
      expect(reportHook.result.current.reportCache.size).toBe(0)
    })
  })

  describe('Store Performance and Memory', () => {
    it('should handle rapid state changes across all stores efficiently', () => {
      const userHook = renderHook(() => useUserStore())
      const loadingHook = renderHook(() => useLoadingStore())
      const reportHook = renderHook(() => useComplianceReportStore())

      const startTime = performance.now()

      act(() => {
        // Simulate rapid operations
        for (let i = 0; i < 50; i++) {
          userHook.result.current.setUser({ id: i, name: `User ${i}` })
          loadingHook.result.current.setLoading(i % 2 === 0)
          
          if (i % 5 === 0) {
            const report = { report: { id: i, title: `Report ${i}` } }
            reportHook.result.current.cacheReport(i, report)
            reportHook.result.current.setCurrentReport(report)
          }
        }
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete rapidly
      expect(duration).toBeLessThan(100)
      
      // Final state should be consistent
      const storedUser = getUser(userHook.result.current.user)
      expect(storedUser.id).toBe(49)
      expect(loadingHook.result.current.loading).toBe(false) // 49 is odd
      expect(reportHook.result.current.reportCache.size).toBe(10) // 0, 5, 10, ..., 45
    })

    it('should maintain store independence during concurrent access', () => {
      // Create multiple hook instances to simulate different components
      const hooks = Array.from({ length: 5 }, () => ({
        user: renderHook(() => useUserStore()),
        loading: renderHook(() => useLoadingStore()),
        report: renderHook(() => useComplianceReportStore())
      }))

      const testUser = { id: 1, name: 'Shared User' }
      const testReport = { report: { id: 1, title: 'Shared Report' } }

      act(() => {
        // Update from different hook instances
        hooks[0].user.result.current.setUser(testUser)
        hooks[1].loading.result.current.setLoading(true)
        hooks[2].report.result.current.setCurrentReport(testReport)
      })

      // All hook instances should see the same state
      hooks.forEach(hook => {
        expect(hook.user.result.current.user).toEqual(testUser)
        expect(hook.loading.result.current.loading).toBe(true)
        expect(hook.report.result.current.currentReport).toEqual(testReport)
      })
    })
  })
})
