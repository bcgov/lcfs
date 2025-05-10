import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'
import { useAuth } from '@/hooks/useAuth'
import { Login } from './Login'

export const ApiDocs = () => {
  const auth = useAuth()

  if (auth.isLoading) {
    return <div>Loading...</div>
  }

  return auth.isAuthenticated && auth.user?.id_token ? (
    <SwaggerUI
      url="http://localhost:8000/api/openapi.json"
      requestInterceptor={(req) => {
        req.headers.Authorization = `Bearer ${auth.user.id_token}`
        return req
      }}
    />
  ) : (
    <Login />
  )
}
