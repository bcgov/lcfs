import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  client: '@hey-api/client-axios',
  input: './shared/openapi.json',
  output: 'src/services/apiClient',
  plugins: [
    '@hey-api/schemas',
    '@hey-api/types',
    {
      name: '@hey-api/services',
      asClass: true
    }
  ]
})
