import { testServer } from '@/../testSetup'
import { apiRoutes } from '@/constants/routes'
import { http, HttpResponse } from 'msw'

const api = 'http://localhost:8000/api'

export const httpOverwrite = (method, endpoint, cb, once) => {
  return testServer.use(http[method](api + endpoint, cb, { once }))
}

export const handlers = [
  http.get(api + apiRoutes.currentUser, () =>
    HttpResponse.json({
      firstName: 'John',
      lastName: 'Doe',
      roles: [{ name: 'Government' }]
    })
  ),
  http.put(api + apiRoutes.updateCategory, () =>
    HttpResponse.json({
      category: 'B'
    })
  ),
  http.get(api + apiRoutes.getTransfer, () =>
    HttpResponse.json({
      transferCategory: null
    })
  )
  // http.get(api + apiRoutes.openapi, () =>
  //   HttpResponse.json({ firstName: 'John', lastName: 'Doe' })
  // )
]
