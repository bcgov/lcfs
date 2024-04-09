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
  )
  // http.get(api + apiRoutes.openapi, () =>
  //   HttpResponse.json({ firstName: 'John', lastName: 'Doe' })
  // )
]
