import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'
import { useKeycloak } from '@react-keycloak/web'
import { Login } from './Login'
import type { SwaggerUIRequest } from 'swagger-ui-react'

export const ApiDocs = (): JSX.Element => {
  const { keycloak } = useKeycloak()
  return keycloak.authenticated ? (
    <SwaggerUI
      url="http://localhost:8000/api/openapi.json"
      requestInterceptor={(req: SwaggerUIRequest) => {
        req.headers.Authorization = `Bearer ${keycloak.token}`
        return req
      }}
    />
  ) : (
    <Login />
  )
}
