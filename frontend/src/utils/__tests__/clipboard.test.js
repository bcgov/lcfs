import { describe, it, expect, beforeEach, vi } from 'vitest'
import { copyToClipboard, isClipboardSupported } from '@/utils/clipboard'

const setSecure = (secure) => {
  Object.defineProperty(window, 'isSecureContext', {
    value: secure,
    writable: true
  })
}

describe('clipboard utils', () => {
  beforeEach(() => {
    // Reset navigator.clipboard and execCommand mocks
    Object.assign(navigator, { clipboard: undefined })
    document.execCommand = vi.fn()
    setSecure(false)
  })

  it('returns true when clipboard API is supported in secure context', () => {
    setSecure(true)
    Object.assign(navigator, { clipboard: {} })
    expect(isClipboardSupported()).toBe(true)
  })

  it('returns false when clipboard API not supported or insecure', () => {
    setSecure(false)
    expect(isClipboardSupported()).toBe(false)
  })

  it('uses modern clipboard API when available', async () => {
    setSecure(true)
    const writeText = vi.fn().mockResolvedValue()
    Object.assign(navigator, { clipboard: { writeText } })

    const ok = await copyToClipboard('hello')
    expect(ok).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('falls back to execCommand when clipboard API fails', async () => {
    setSecure(true)
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.assign(navigator, { clipboard: { writeText } })
    document.execCommand = vi.fn().mockReturnValue(true)

    const ok = await copyToClipboard('hello')
    expect(ok).toBe(true)
    expect(document.execCommand).toHaveBeenCalledWith('copy')
  })

  it('fallback returns false when execCommand fails', async () => {
    setSecure(false)
    document.execCommand = vi.fn().mockReturnValue(false)

    const ok = await copyToClipboard('text')
    expect(ok).toBe(false)
  })

  it('returns false on invalid input', async () => {
    const ok = await copyToClipboard()
    expect(ok).toBe(false)
  })
})
