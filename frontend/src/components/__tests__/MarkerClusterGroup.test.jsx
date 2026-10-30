import { describe, it, expect, vi, afterEach } from 'vite-plus/test'

const ClusterComponent = ({ children }) => children

const loadWithModule = async (moduleDefault) => {
  vi.resetModules()
  vi.doMock('react-leaflet-cluster', () => ({ default: moduleDefault }))
  return (await import('@/components/MarkerClusterGroup')).default
}

describe('MarkerClusterGroup', () => {
  afterEach(() => {
    vi.doUnmock('react-leaflet-cluster')
  })

  it('unwraps the component when the default import is the CommonJS exports object', async () => {
    // Vite 8 build: the default import is module.exports of the CJS package
    const MarkerClusterGroup = await loadWithModule({
      __esModule: true,
      default: ClusterComponent
    })

    expect(MarkerClusterGroup).toBe(ClusterComponent)
  })

  it('passes the component through when the default import is already unwrapped', async () => {
    const MarkerClusterGroup = await loadWithModule(ClusterComponent)

    expect(MarkerClusterGroup).toBe(ClusterComponent)
  })
})
