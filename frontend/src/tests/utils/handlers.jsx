import { testServer } from '@/../testSetup'
import { apiRoutes } from '@/constants/routes'
import { http, HttpResponse } from 'msw'

const api = 'http://localhost:8000/api'

export const httpOverwrite = (method, endpoint, cb, once) => {
  return testServer.use(http[method](api + endpoint, cb, { once }))
}

export const handlers = [
  // Auth and user endpoints
  http.get(api + apiRoutes.currentUser, () =>
    HttpResponse.json({
      firstName: 'John',
      lastName: 'Doe',
      roles: [{ name: 'Government' }],
      organization: { name: 'Test Organization' }
    })
  ),
  
  // Organizations
  http.get(api + apiRoutes.organizationSearch, () =>
    HttpResponse.json([])
  ),
  
  // Transactions
  http.get(api + apiRoutes.transactions, () =>
    HttpResponse.json([])
  ),
  
  // Transfers
  http.put(api + apiRoutes.updateCategory, () =>
    HttpResponse.json({
      category: 'B'
    })
  ),
  http.get(api + apiRoutes.getTransfer, () =>
    HttpResponse.json({
      transferCategory: null
    })
  ),
  
  // Compliance reports
  http.get(api + apiRoutes.getComplianceReports, () =>
    HttpResponse.json([])
  ),
  http.get(api + apiRoutes.getCompliancePeriods, () =>
    HttpResponse.json([])
  ),
  
  // Fuel codes
  http.get(api + apiRoutes.getFuelCodes, () =>
    HttpResponse.json([])
  ),
  http.get(api + apiRoutes.fuelCodeOptions, () =>
    HttpResponse.json({})
  ),
  
  // Dashboard
  http.get(api + apiRoutes.directorReviewCounts, () =>
    HttpResponse.json({})
  ),
  http.get(api + apiRoutes.TransactionCounts, () =>
    HttpResponse.json({})
  ),
  
  // Roles
  http.get(api + apiRoutes.roles, () =>
    HttpResponse.json([])
  ),
  
  // Notifications
  http.get(api + apiRoutes.getNotifications, () =>
    HttpResponse.json([])
  ),
  http.get(api + apiRoutes.getNotificationsCount, () =>
    HttpResponse.json({ count: 0 })
  ),
  
  // Audit logs
  http.get(api + apiRoutes.getAuditLogs, () =>
    HttpResponse.json([])
  ),
  
  // Fallback handler for any unhandled API calls
  http.get(`${api}/*`, () => {
    return HttpResponse.json({}, { status: 200 })
  }),
  http.post(`${api}/*`, () => {
    return HttpResponse.json({}, { status: 200 })
  }),
  http.put(`${api}/*`, () => {
    return HttpResponse.json({}, { status: 200 })
  }),
  http.delete(`${api}/*`, () => {
    return HttpResponse.json({}, { status: 200 })
  })
]
