import { describe, expect, it } from 'vite-plus/test'
import { getKeycloakConfig, type KeycloakConfig } from '../config'

const sharedConfig: KeycloakConfig = {
  REALM: 'standard',
  CLIENT_ID: 'shared-client',
  AUTH_URL: 'https://login.example.com/auth',
  POST_LOGOUT_URL: 'http://localhost:3000/',
  SM_LOGOUT_URL: 'https://logout.example.com?return='
}

describe('getKeycloakConfig', () => {
  it('uses local Keycloak only when enabled on localhost', () => {
    const config = getKeycloakConfig(sharedConfig, {
      hostname: 'localhost',
      origin: 'http://localhost:63001',
      viteEnv: { VITE_LOCAL_KEYCLOAK: 'true' }
    })

    expect(config).toMatchObject({
      REALM: 'lcfs-local',
      CLIENT_ID: 'low-carbon-fuel-standard-5147',
      AUTH_URL: 'http://localhost:8180',
      POST_LOGOUT_URL: 'http://localhost:63001/',
      SM_LOGOUT_URL: '',
      LOCAL_AUTH: true
    })
  })

  it('keeps the shared configuration on non-local hosts', () => {
    const config = getKeycloakConfig(sharedConfig, {
      hostname: '127.0.0.1',
      origin: 'http://127.0.0.1:63001',
      viteEnv: { VITE_LOCAL_KEYCLOAK: 'true' }
    })

    expect(config).toMatchObject({
      REALM: 'standard',
      CLIENT_ID: 'shared-client',
      AUTH_URL: 'https://login.example.com/auth',
      POST_LOGOUT_URL: 'http://localhost:3000/',
      SM_LOGOUT_URL: 'https://logout.example.com?return=',
      LOCAL_AUTH: false
    })
  })

  it('keeps the shared configuration when local mode is not enabled', () => {
    const config = getKeycloakConfig(sharedConfig, {
      hostname: 'localhost',
      origin: 'http://localhost:63001',
      viteEnv: {}
    })

    expect(config.LOCAL_AUTH).toBe(false)
    expect(config.AUTH_URL).toBe('https://login.example.com/auth')
  })
})
