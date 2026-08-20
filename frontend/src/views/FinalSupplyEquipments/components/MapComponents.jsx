import { useEffect, useState } from 'react'
import { useMap, Marker, Popup, TileLayer } from 'react-leaflet'
import { createPortal } from 'react-dom'
import { Control, DomEvent, DomUtil } from 'leaflet'
import { Paper, CircularProgress } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { markerIcons } from './utils'

// Custom Control component using React portals
export const MapControl = ({ position = 'topright', disableClickPropagation = false, children }) => {
  const [container, setContainer] = useState(null)
  const map = useMap()

  useEffect(() => {
    // Create a new map control
    const mapControl = new Control({ position })
    
    mapControl.onAdd = () => {
      const section = DomUtil.create('section')
      
      if (disableClickPropagation) {
        DomEvent.disableClickPropagation(section)
        DomEvent.disableScrollPropagation(section)
      }
      
      setContainer(section)
      return section
    }

    mapControl.onRemove = () => {
      setContainer(null)
    }

    // Add the control to the map
    map.addControl(mapControl)

    // Cleanup function
    return () => {
      map.removeControl(mapControl)
    }
  }, [map, position, disableClickPropagation])

  // Use createPortal to render React components inside the Leaflet control
  return container ? createPortal(children, container) : null
}

// Component to fit the map bounds when locations change
export const MapBoundsHandler = ({ groupedLocations }) => {
  const map = useMap()

  useEffect(() => {
    if (Object.keys(groupedLocations).length > 0) {
      const bounds = Object.values(groupedLocations).map((group) => [
        group[0].lat,
        group[0].lng
      ])

      if (bounds.length > 0) {
        map.fitBounds(bounds)
      }
    }
  }, [map, groupedLocations])

  return null
}

// Legend component for react-leaflet
export const MapLegend = ({ geofencingStatus }) => {
  const legendItems = [
    // The grey pin means "no verdict yet" while geofencing runs and "never
    // resolved" once it finishes — it is no longer reused for out-of-province
    // locations, so it needs a label in both states (#4852).
    {
      src: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png',
      alt: 'Grey marker',
      text:
        geofencingStatus === 'loading'
          ? 'Checking location...'
          : 'Location could not be verified'
    },
    // Always include these items
    {
      src: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      alt: 'Blue marker',
      text: 'Inside BC, no overlaps'
    },
    {
      src: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
      alt: 'Orange marker',
      text: 'Period overlap (same Serial#)'
    },
    {
      src: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
      alt: 'Red marker',
      text: 'Outside BC'
    }
  ]

  return (
    <MapControl position="bottomright" disableClickPropagation={true}>
      <Paper elevation={3} sx={{ p: 1, maxWidth: 300 }}>
        <BCTypography variant="body2" fontWeight="bold" gutterBottom>
          Legend
        </BCTypography>

        {legendItems.map((item, index) => (
          <div
            key={item.alt}
            style={{ marginBottom: index < legendItems.length - 1 ? '5px' : 0 }}
          >
            <img src={item.src} height="20" alt={item.alt} />
            <BCTypography variant="body" ml={1} component="span">
              {item.text}
            </BCTypography>
          </div>
        ))}
      </Paper>
    </MapControl>
  )
}

// Map markers component to separate marker rendering logic
export const MapMarkers = ({
  groupedLocations,
  geofencingStatus,
  geofencingResults,
  overlapMap,
  generatePopupContent
}) => {
  return (
    <>
      {Object.entries(groupedLocations).map(([coordKey, locGroup]) => {
        const firstLoc = locGroup[0]
        const position = [firstLoc.lat, firstLoc.lng]

        // Determine marker icon based on geofencing results and overlap status
        let icon = markerIcons.grey // Default to loading icon

        if (geofencingStatus === 'completed') {
          const isInBC = geofencingResults[coordKey]

          const hasAnyOverlaps = locGroup.some(
            (loc) =>
              overlapMap[loc.uniqueId] && overlapMap[loc.uniqueId].length > 0
          )

          // Only an explicit `false` means out of province. A missing result
          // means the location was never resolved, and painting those red
          // reported valid BC sites as outside BC (#4852) — leave them grey,
          // matching the "Checking location..." legend entry.
          if (isInBC === false) {
            icon = markerIcons.red
          } else if (isInBC === undefined) {
            icon = markerIcons.grey
          } else if (hasAnyOverlaps) {
            icon = markerIcons.orange
          } else {
            icon = markerIcons.default
          }
        }

        return (
          <Marker key={coordKey} position={position} icon={icon}>
            <Popup maxWidth={400}>
              {geofencingStatus === 'completed' ? (
                generatePopupContent(coordKey, locGroup)
              ) : (
                <div>
                  <BCTypography variant="body" component="div">
                    {firstLoc.name}
                  </BCTypography>
                  <CircularProgress size={20} sx={{ mt: 1 }} />
                  <BCTypography variant="body">
                    Checking location...
                  </BCTypography>
                </div>
              )}
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}

// Base Map component with the tiles
export const BaseMap = () => {
  return (
    <TileLayer
      attribution='Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
  )
}
