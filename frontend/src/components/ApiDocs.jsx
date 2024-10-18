import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'
import { useKeycloak } from '@react-keycloak/web'
import { Login } from './Login'

export const ApiDocs = () => {
  const { keycloak } = useKeycloak()
  return keycloak.authenticated ? (
    <SwaggerUI
      url="http://localhost:8000/api/openapi.json"
      requestInterceptor={(req) => {
        req.headers.Authorization = `Bearer ${keycloak.idToken}`
        return req
      }}
    />
  ) : (
    <Login />
  )
}
