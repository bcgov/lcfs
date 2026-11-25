import markerClusterGroupModule from 'react-leaflet-cluster'

// react-leaflet-cluster only ships a CommonJS build compiled from ES modules
// (`exports.__esModule` + `exports.default`). Vite 8 applies Node's interop to
// files in a "type": "module" package, so the default import above is the whole
// `module.exports` object rather than the component, and rendering it fails
// with React error #130. Unwrap it here; test mocks (and bundlers that honour
// `__esModule`) already hand back the component itself.
type MarkerClusterGroupModule =
  | typeof markerClusterGroupModule
  | { __esModule: true; default: typeof markerClusterGroupModule }

const importedModule = markerClusterGroupModule as MarkerClusterGroupModule
const MarkerClusterGroup =
  '__esModule' in importedModule && importedModule.__esModule
    ? importedModule.default
    : importedModule

export default MarkerClusterGroup
