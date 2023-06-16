import React from 'react'
import { createRoot } from 'react-dom/client';
import { ReactKeycloakProvider } from '@react-keycloak/web'
import { QueryClient, QueryClientProvider } from 'react-query'
import { getKeycloak, keycloakInitOptions } from './keycloak'
import AppRouter from './routes'
import Loading from './components/Loading'
import './index.css'

const queryClient = new QueryClient()
const keycloak = getKeycloak()
const root = document.getElementById('root');

if (root) {
  createRoot(root).render(
    <ReactKeycloakProvider
      authClient={keycloak}
      initOptions={keycloakInitOptions}
      LoadingComponent={<Loading />}
    >
      <QueryClientProvider client={queryClient}>
        <AppRouter />
      </QueryClientProvider>
    </ReactKeycloakProvider>
  );
}