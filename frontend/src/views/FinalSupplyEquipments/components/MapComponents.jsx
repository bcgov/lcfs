import { useEffect } from 'react'
import { useMap, Marker, Popup, TileLayer } from 'react-leaflet'
import Control from 'react-leaflet-custom-control'
import { Paper, CircularProgress } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { markerIcons } from './utils'

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
    // Conditionally include the loading state item
    ...(geofencingStatus === 'loading'
      ? [
          {
            src: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png',
            alt: 'Grey marker',
            text: 'Checking location...'
          }
        ]
      : []),
    // Always include these items
    {
      src: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      alt: 'Blue marker',
      text: 'Inside BC, no overlaps'
    },
    {
      src: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
      alt: 'Orange marker',
      text: 'Period overlap (same Reg# & Serial#)'
    },
    {
      src: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
      alt: 'Red marker',
      text: 'Outside BC'
    }
  ]

  return (
    <Control prepend position="bottomright">
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
    </Control>
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
          const isInBC = geofencingResults[firstLoc.id]

          const hasAnyOverlaps = locGroup.some(
            (loc) =>
              overlapMap[loc.uniqueId] && overlapMap[loc.uniqueId].length > 0
          )

          if (!isInBC) {
            icon = markerIcons.red
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
