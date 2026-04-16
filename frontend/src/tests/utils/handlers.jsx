import { testServer } from '@/../testSetup'
import { apiRoutes } from '@/constants/routes'
import { http, HttpResponse } from 'msw'

const api = 'http://localhost:8000/api'
const reportOpenings = [
  {
    reportOpeningId: 1,
    complianceYear: 2019,
    complianceReportingEnabled: true,
    earlyIssuanceEnabled: false,
    supplementalReportRole: 'BCeID'
  },
  {
    reportOpeningId: 2,
    complianceYear: 2020,
    complianceReportingEnabled: false,
    earlyIssuanceEnabled: false,
    supplementalReportRole: 'BCeID'
  }
]

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
  http.get(api + '/organizations/search', () =>
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
  http.get(api + apiRoutes.reportOpenings, () =>
    HttpResponse.json(reportOpenings)
  ),
  http.put(api + apiRoutes.reportOpenings, async ({ request }) => {
    const body = await request.json()
    const updatedYears = body?.reportOpenings ?? []
    const updated = reportOpenings.map((entry) => {
      const override = updatedYears.find(
        (item) => item.complianceYear === entry.complianceYear
      )
      if (!override) {
        return entry
      }
      return {
        ...entry,
        complianceReportingEnabled:
          override.complianceReportingEnabled ?? entry.complianceReportingEnabled,
        earlyIssuanceEnabled:
          override.earlyIssuanceEnabled ?? entry.earlyIssuanceEnabled,
        supplementalReportRole:
          override.supplementalReportRole ?? entry.supplementalReportRole
      }
    })
    return HttpResponse.json(updated)
  }),

  // Address geocoder API for AddressAutocomplete
  http.get('https://geocoder.api.gov.bc.ca/addresses.json', ({ request }) => {
    const url = new URL(request.url)
    const addressString = url.searchParams.get('addressString')
    const maxResults = url.searchParams.get('maxResults') || '5'
    
    // Mock response based on search query
    if (!addressString || addressString.length < 3) {
      return HttpResponse.json({
        features: [],
        queryAddress: addressString || ''
      })
    }

    // Mock successful address search results
    const features = [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [-123.3656, 48.4284]
        },
        properties: {
          fullAddress: `${addressString} Main St, Victoria, BC V8W 1A1`,
          siteName: '',
          unitDesignator: '',
          unitNumber: '',
          unitNumberSuffix: '',
          civicNumber: addressString.split(' ')[0] || '123',
          civicNumberSuffix: '',
          streetName: 'Main',
          streetType: 'St',
          streetDirection: '',
          streetQualifier: '',
          localityName: 'Victoria',
          localityType: 'City',
          electoralArea: '',
          provinceCode: 'BC',
          locationPositionalAccuracy: 'high',
          locationDescriptor: 'frontDoorPoint',
          siteID: '12345',
          blockID: '67890',
          score: 95
        }
      },
      {
        type: 'Feature', 
        geometry: {
          type: 'Point',
          coordinates: [-123.1207, 49.2827]
        },
        properties: {
          fullAddress: `${addressString} Commercial Dr, Vancouver, BC V5N 4A8`,
          siteName: '',
          unitDesignator: '',
          unitNumber: '',
          unitNumberSuffix: '',
          civicNumber: addressString.split(' ')[0] || '456',
          civicNumberSuffix: '',
          streetName: 'Commercial',
          streetType: 'Dr',
          streetDirection: '',
          streetQualifier: '',
          localityName: 'Vancouver',
          localityType: 'City',
          electoralArea: '',
          provinceCode: 'BC',
          locationPositionalAccuracy: 'high',
          locationDescriptor: 'frontDoorPoint',
          siteID: '54321',
          blockID: '09876',
          score: 90
        }
      }
    ].slice(0, parseInt(maxResults))

    return HttpResponse.json({
      type: 'FeatureCollection',
      queryAddress: addressString,
      features: features
    })
  }),
  
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
  }),
  
  // Catch-all handlers for any external requests to prevent AggregateErrors
  http.get('*', ({ request }) => {
    // Only handle external requests, not our API
    if (request.url.startsWith(api)) {
      return
    }
    return HttpResponse.json({}, { status: 200 })
  }),
  http.post('*', ({ request }) => {
    if (request.url.startsWith(api)) {
      return
    }
    return HttpResponse.json({}, { status: 200 })
  }),
  http.put('*', ({ request }) => {
    if (request.url.startsWith(api)) {
      return
    }
    return HttpResponse.json({}, { status: 200 })
  }),
  http.delete('*', ({ request }) => {
    if (request.url.startsWith(api)) {
      return
    }
    return HttpResponse.json({}, { status: 200 })
  })
]
