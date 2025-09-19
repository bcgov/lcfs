import { describe, it, expect, vi } from 'vitest'
import { fixLeafletIcons, createMarkerIcon, markerIcons } from '../../components/utils'

// Mock Leaflet
vi.mock('leaflet', () => {
  const MockIconDefault = class {
    constructor() {
      this._getIconUrl = vi.fn()
    }
  }
  MockIconDefault.mergeOptions = vi.fn()
  
  const MockIcon = class {
    constructor(options) {
      this.options = options
    }
  }
  MockIcon.Default = MockIconDefault
  
  return {
    default: {
      Icon: MockIcon
    },
    Icon: MockIcon
  }
})

describe('utils', () => {
  describe('fixLeafletIcons', () => {
    it('calls fixLeafletIcons without errors', () => {
      expect(() => fixLeafletIcons()).not.toThrow()
    })
  })

  describe('createMarkerIcon', () => {
    it('creates marker icon with specified color', () => {
      const result = createMarkerIcon('red')
      expect(result).toBeDefined()
    })
  })

  describe('markerIcons', () => {
    it('exports marker icons object', () => {
      expect(markerIcons).toBeDefined()
      expect(markerIcons).toHaveProperty('default')
      expect(markerIcons).toHaveProperty('green')
      expect(markerIcons).toHaveProperty('red')
      expect(markerIcons).toHaveProperty('orange')
      expect(markerIcons).toHaveProperty('grey')
    })
  })
})