import L from 'leaflet'

// Leaflet's default icon
export const fixLeafletIcons = () => {
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png'
  })
}

// Create a marker icons map to avoid URL imports
export const createMarkerIcon = (color) => {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
    shadowUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
  })
}

// Prepare marker icons
export const markerIcons = {
  default: new L.Icon.Default(),
  blue: createMarkerIcon('blue'),
  gold: createMarkerIcon('gold'),
  red: createMarkerIcon('red'),
  green: createMarkerIcon('green'),
  orange: createMarkerIcon('orange'),
  yellow: createMarkerIcon('yellow'),
  violet: createMarkerIcon('violet'),
  grey: createMarkerIcon('grey'),
  black: createMarkerIcon('black')
}
