import { describe, it, expect } from 'vite-plus/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// LCFS-SEC-024: the SPA is served by nginx, which only set X-Frame-Options.
// These assertions fail against the pre-fix nginx.conf and pass once the
// security headers below are added at the http level.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const nginxConfPath = path.resolve(__dirname, '../../../nginx.conf')
const nginxConf = readFileSync(nginxConfPath, 'utf-8')

const extractDirective = (name: string): string => {
  const match = nginxConf.match(
    new RegExp(`add_header\\s+${name}\\s+"([^"]+)"\\s+always;`)
  )
  expect(match, `expected ${name} header to be configured`).not.toBeNull()
  return match![1]
}

describe('nginx security headers (LCFS-SEC-024)', () => {
  it('sets a Content-Security-Policy without unsafe-inline/unsafe-eval scripts', () => {
    const csp = extractDirective('Content-Security-Policy')

    expect(csp).toContain("script-src 'self'")
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/)
    expect(csp).not.toMatch(/script-src[^;]*unsafe-eval/)
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'self'")
  })

  it('sets Strict-Transport-Security with a long max-age and includeSubDomains', () => {
    const hsts = extractDirective('Strict-Transport-Security')

    const maxAgeMatch = hsts.match(/max-age=(\d+)/)
    expect(maxAgeMatch).not.toBeNull()
    expect(Number(maxAgeMatch![1])).toBeGreaterThanOrEqual(31536000) // >= 1 year
    expect(hsts).toContain('includeSubDomains')
  })

  it('sets X-Content-Type-Options to nosniff', () => {
    expect(nginxConf).toMatch(
      /add_header\s+X-Content-Type-Options\s+nosniff\s+always;/
    )
  })

  it('sets a Referrer-Policy', () => {
    expect(nginxConf).toMatch(
      /add_header\s+Referrer-Policy\s+strict-origin-when-cross-origin\s+always;/
    )
  })

  it('sets a minimal Permissions-Policy disabling unused sensitive APIs', () => {
    const permissionsPolicy = extractDirective('Permissions-Policy')

    expect(permissionsPolicy).toContain('geolocation=()')
    expect(permissionsPolicy).toContain('camera=()')
    expect(permissionsPolicy).toContain('microphone=()')
  })

  it('still sends X-Frame-Options for defense in depth', () => {
    expect(nginxConf).toMatch(
      /add_header\s+X-Frame-Options\s+SAMEORIGIN\s+always;/
    )
  })
})
