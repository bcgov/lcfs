import React from 'react'
import { createRoot } from 'react-dom/client';
import { ReactKeycloakProvider } from '@react-keycloak/web'
import { QueryClient, QueryClientProvider } from 'react-query'
import { getKeycloak, keycloakInitOptions } from './keycloak'
import App from './App'
import Loading from './components/Loading'
import './styles/index.scss'

const queryClient = new QueryClient()
const keycloak = getKeycloak()
const root = document.getElementById('root')

if (root) {
  createRoot(root).render(
    <ReactKeycloakProvider
      authClient={keycloak}
      initOptions={keycloakInitOptions}
      LoadingComponent={<Loading />}
    >
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ReactKeycloakProvider>
  )
}
