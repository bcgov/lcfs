import React, { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import {
  Paper,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material'
import Control from 'react-leaflet-custom-control'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useGetFinalSupplyEquipments } from '@/hooks/useFinalSupplyEquipment'
import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'

// Fix Leaflet's default icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png'
})

// Create a marker icons map to avoid URL imports
const createMarkerIcon = (color) => {
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
const markerIcons = {
  default: new L.Icon.Default(),
  red: createMarkerIcon('red'),
  orange: createMarkerIcon('orange'),
  grey: createMarkerIcon('grey')
}

// Geofencing approach using Nominatim for reverse geocoding
const checkLocationInBC = async (lat, lng) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'BC-Travel-Planner/1.0'
        }
      }
    )

    if (!response.ok) {
      throw new Error('Reverse geocoding request failed')
    }

    const data = await response.json()

    // Check if the location is in British Columbia
    const state = data.address?.state || data.address?.province || ''
    const country = data.address?.country || ''
    const stateDistrict = data.address?.state_district || ''

    // Return true if it's explicitly BC, or likely in BC based on surrounding data
    return (
      (state.toLowerCase().includes('british columbia') ||
        stateDistrict.toLowerCase().includes('british columbia')) &&
      country.toLowerCase() === 'canada'
    )
  } catch (error) {
    console.error('Error checking location with geofencing:', error)
    // Fallback to simple boundary check if the API fails
    return lat > 48.0 && lat < 60.0 && lng > -139.0 && lng < -114.03
  }
}

// Batch process location geofencing checks
const batchProcessGeofencing = async (locations) => {
  const results = {}
  const batchSize = 3 // Process 3 locations at a time

  for (let i = 0; i < locations.length; i += batchSize) {
    const batch = locations.slice(i, i + batchSize)
    const batchPromises = batch.map(async (loc) => {
      const isInBC = await checkLocationInBC(loc.lat, loc.lng)
      return { id: loc.id, isInBC }
    })

    const batchResults = await Promise.all(batchPromises)

    // Add batch results to the overall results
    batchResults.forEach(({ id, isInBC }) => {
      results[id] = isInBC
    })
    if (i + batchSize < locations.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  return results
}

// Check if date ranges overlap between two locations
const datesOverlap = (start1, end1, start2, end2) => {
  const s1 = new Date(start1)
  const e1 = new Date(end1)
  const s2 = new Date(start2)
  const e2 = new Date(end2)

  return s1 <= e2 && s2 <= e1
}

// Find all overlapping periods for a given location, only considering same ID
const findOverlappingPeriods = (currentLoc, allLocations) => {
  const currentRegNum = currentLoc.id.split('_')[0]
  const currentSerialNum = currentLoc.id.split('_')[1]

  return allLocations
    .filter((loc) => {
      const locRegNum = loc.id.split('_')[0]
      const locSerialNum = loc.id.split('_')[1]

      // Only check for overlap if this is the same ID but different record
      return (
        currentLoc.uniqueId !== loc.uniqueId && // Different record
        currentRegNum === locRegNum && // Same registration number
        currentSerialNum === locSerialNum && // Same serial number
        datesOverlap(
          currentLoc.supplyFromDate,
          currentLoc.supplyToDate,
          loc.supplyFromDate,
          loc.supplyToDate
        )
      )
    })
    .map((loc) => ({
      id: loc.id,
      uniqueId: loc.uniqueId,
      name: loc.name,
      regNum: loc.id.split('_')[0],
      serialNum: loc.id.split('_')[1],
      supplyFromDate: loc.supplyFromDate,
      supplyToDate: loc.supplyToDate
    }))
}

// Group locations by their coordinates
const groupLocationsByCoordinates = (locations) => {
  const grouped = {}

  locations.forEach((location) => {
    const key = `${location.lat.toFixed(6)},${location.lng.toFixed(6)}`

    if (!grouped[key]) {
      grouped[key] = []
    }

    grouped[key].push(location)
  })

  return grouped
}

// Component to fit the map bounds when locations change
const MapBoundsHandler = ({ groupedLocations }) => {
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
const MapLegend = ({ geofencingStatus }) => {
  return (
    <Control prepend position="bottomright">
      <Paper elevation={3} sx={{ p: 1, maxWidth: 300 }}>
        <BCTypography variant="body2" fontWeight="bold" gutterBottom>
          Legend
        </BCTypography>

        {geofencingStatus === 'loading' && (
          <div style={{ marginBottom: '5px' }}>
            <img
              src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png"
              height="20"
            />
            Checking location...
          </div>
        )}

        <div style={{ marginBottom: '5px' }}>
          <img
            src="https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png"
            height="20"
          />
          <BCTypography variant="body" ml={1} component="span">
            Inside BC, no overlaps
          </BCTypography>
        </div>
        <div style={{ marginBottom: '5px' }}>
          <img
            src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png"
            height="20"
          />
          <BCTypography variant="body" ml={1} component="span">
            Period overlap (same Reg# & Serial#)
          </BCTypography>
        </div>
        <div>
          <img
            src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png"
            height="20"
          />
          <BCTypography variant="body" ml={1} component="span">
            Outside BC
          </BCTypography>
        </div>
      </Paper>
    </Control>
  )
}

const ExcelStyledTable = ({ uniqueSupplyUnits, overlapMap }) => {
  return (
    <TableContainer component={Paper} sx={{ maxHeight: 200, borderRadius: 0 }}>
      <Table
        size="small"
        stickyHeader
        sx={{
          '& .MuiTableCell-root': {
            fontSize: '0.71rem',
            p: 0,
            pl: 0.2,
            pr: 0.2
          }
        }}
      >
        <TableHead>
          <TableRow sx={{ backgroundColor: '#f4f4f4' }}>
            {' '}
            <TableCell
              sx={{
                border: '1px solid #d0d0d0',
                fontWeight: 'bold',
                backgroundColor: '#dfe6e9'
              }}
            >
              Reg #
            </TableCell>
            <TableCell
              sx={{
                border: '1px solid #d0d0d0',
                fontWeight: 'bold',
                backgroundColor: '#dfe6e9'
              }}
            >
              Serial #
            </TableCell>
            <TableCell
              sx={{
                border: '1px solid #d0d0d0',
                fontWeight: 'bold',
                backgroundColor: '#dfe6e9'
              }}
            >
              Periods
            </TableCell>
            <TableCell
              sx={{
                border: '1px solid #d0d0d0',
                fontWeight: 'bold',
                backgroundColor: '#dfe6e9'
              }}
            >
              Status
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {Object.values(uniqueSupplyUnits).map((unit, index) => {
            const sortedRecords = [...unit.records].sort(
              (a, b) => new Date(a.supplyFromDate) - new Date(b.supplyFromDate)
            )

            return (
              <React.Fragment key={index}>
                <TableRow
                  sx={{
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9f9f9',
                    '&:hover': { backgroundColor: '#e3f2fd' }
                  }}
                >
                  <TableCell
                    sx={{ border: '1px solid #d0d0d0', fontSize: '14px' }}
                  >
                    {unit.regNum}
                  </TableCell>
                  <TableCell
                    sx={{ border: '1px solid #d0d0d0', fontSize: '14px' }}
                  >
                    {unit.serialNum}
                  </TableCell>
                  <TableCell
                    sx={{ border: '1px solid #d0d0d0', fontSize: '14px' }}
                  >
                    {sortedRecords.map((record, idx) => (
                      <div
                        key={idx}
                        style={{
                          color: record.hasOverlap ? 'orange' : 'inherit',
                          fontWeight: record.hasOverlap ? 'bold' : 'normal'
                        }}
                      >
                        {record.supplyFromDate} → {record.supplyToDate}
                      </div>
                    ))}
                  </TableCell>
                  <TableCell
                    sx={{
                      border: '1px solid #d0d0d0',
                      fontSize: '14px',
                      color: unit.hasOverlap ? 'orange' : 'green'
                    }}
                  >
                    {unit.hasOverlap ? '⚠️ Period overlap' : '✓ No overlap'}
                  </TableCell>
                </TableRow>

                {/* Overlapping Period Details */}
                {unit.hasOverlap &&
                  sortedRecords
                    .filter((record) => record.hasOverlap)
                    .map((record, idx) => (
                      <TableRow
                        key={`detail-${idx}`}
                        sx={{
                          backgroundColor: '#fff3e0', // Light orange for warnings
                          '&:hover': { backgroundColor: '#ffe0b2' } // Darker on hover
                        }}
                      >
                        <TableCell
                          colSpan={4}
                          sx={{ border: '1px solid #d0d0d0', pl: 3 }}
                        >
                          <strong>Details for period:</strong>{' '}
                          {record.supplyFromDate} → {record.supplyToDate}
                          <br />
                          <strong style={{ color: 'orange' }}>
                            ⚠️ Overlaps with:
                          </strong>
                          <ul style={{ paddingLeft: 20, margin: '5px 0' }}>
                            {overlapMap[record.uniqueId].map((overlap, i) => (
                              <li key={i}>
                                Period: {overlap.supplyFromDate} →{' '}
                                {overlap.supplyToDate}
                              </li>
                            ))}
                          </ul>
                        </TableCell>
                      </TableRow>
                    ))}
              </React.Fragment>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

const MapComponent = ({ complianceReportId }) => {
  const [locations, setLocations] = useState([])
  const [groupedLocations, setGroupedLocations] = useState({})
  const [error, setError] = useState(null)
  const [overlapMap, setOverlapMap] = useState({})
  const [geofencingResults, setGeofencingResults] = useState({})
  const [geofencingStatus, setGeofencingStatus] = useState('idle')
  const [overlapStats, setOverlapStats] = useState({
    total: 0,
    overlapping: 0,
    nonOverlapping: 0,
    bcOverlapping: 0,
    nonBcOverlapping: 0
  })

  const {
    data: supplyEquipmentData,
    isLoading,
    isError,
    refetch
  } = useGetFinalSupplyEquipments(complianceReportId)

  // Transform API data to match the expected format
  const transformApiData = useCallback((data) => {
    if (!data || !data.finalSupplyEquipments) return []

    return data.finalSupplyEquipments.map((row, index) => {
      // Create a combined ID from registrationNbr and serialNbr
      const registrationNbr = row.registrationNbr || 'unknown'
      const serialNbr = row.serialNbr || 'unknown'
      const combinedId = `${registrationNbr}_${serialNbr}`

      return {
        id: row.finalSupplyEquipmentId,
        uniqueId: `${combinedId}_${index}`,
        registrationNbr,
        serialNbr,
        name:
          `${row.streetAddress || ''}, ${row.city || ''}, ${
            row.postalCode || ''
          }`.trim() || `Location ${index}`,
        lat: parseFloat(row.latitude) || 0,
        lng: parseFloat(row.longitude) || 0,
        supplyFromDate:
          row.supplyFromDate || new Date().toISOString().split('T')[0],
        supplyToDate: row.supplyToDate || new Date().toISOString().split('T')[0]
      }
    })
  }, [])

  useEffect(() => {
    if (supplyEquipmentData) {
      const transformedData = transformApiData(supplyEquipmentData)

      if (transformedData.length === 0) {
        console.warn('No location data found in API response')
        setError(new Error('No location data found'))
      } else {
        setLocations(transformedData)
        // Group locations by coordinates
        const grouped = groupLocationsByCoordinates(transformedData)
        setGroupedLocations(grouped)

        setError(null)
      }
    }
  }, [supplyEquipmentData, transformApiData])

  // Run geofencing when locations are loaded
  useEffect(() => {
    if (locations.length > 0 && geofencingStatus === 'idle') {
      setGeofencingStatus('loading')
      const uniqueLocations = Object.values(groupedLocations).map(
        (group) => group[0]
      )

      batchProcessGeofencing(uniqueLocations)
        .then((results) => {
          const expandedResults = {}

          Object.entries(groupedLocations).forEach(([coordKey, locGroup]) => {
            const firstLocId = locGroup[0].id
            const isInBC = results[firstLocId]
            locGroup.forEach((loc) => {
              expandedResults[loc.id] = isInBC
            })
          })

          setGeofencingResults(expandedResults)
          setGeofencingStatus('completed')
          console.log('Geofencing results:', expandedResults)
        })
        .catch((error) => {
          console.error('Error during geofencing:', error)
          setGeofencingStatus('error')
        })
    }
  }, [locations, groupedLocations, geofencingStatus])

  // Calculate overlaps when locations and geofencing are completed
  useEffect(() => {
    if (locations.length > 0 && geofencingStatus === 'completed') {
      const overlaps = {}
      const stats = {
        total: locations.length,
        overlapping: 0,
        nonOverlapping: 0,
        bcOverlapping: 0,
        nonBcOverlapping: 0
      }
      locations.forEach((loc) => {
        const overlappingPeriods = findOverlappingPeriods(loc, locations)
        overlaps[loc.uniqueId] = overlappingPeriods

        const isInBC = geofencingResults[loc.id]
        const hasOverlap = overlappingPeriods.length > 0

        if (hasOverlap) {
          stats.overlapping++
          if (isInBC) {
            stats.bcOverlapping++
          } else {
            stats.nonBcOverlapping++
          }
        } else {
          stats.nonOverlapping++
        }
      })

      setOverlapMap(overlaps)
      setOverlapStats(stats)
      console.log('Period overlaps:', overlaps)
      console.log('Overlap statistics:', stats)
    }
  }, [locations, geofencingResults, geofencingStatus])

  // Generate the popup content for a location group
  const generatePopupContent = (coordKey, locGroup) => {
    const firstLoc = locGroup[0]
    const isInBC = geofencingResults[firstLoc.id] || false

    // Get unique supply units at this location
    const uniqueSupplyUnits = {}
    locGroup.forEach((loc) => {
      if (!uniqueSupplyUnits[loc.id]) {
        uniqueSupplyUnits[loc.id] = {
          regNum: loc.registrationNbr,
          serialNum: loc.serialNbr,
          hasOverlap: false,
          records: []
        }
      }

      // Check if this specific record has overlaps
      const hasOverlap =
        overlapMap[loc.uniqueId] && overlapMap[loc.uniqueId].length > 0
      if (hasOverlap) {
        uniqueSupplyUnits[loc.id].hasOverlap = true
      }

      uniqueSupplyUnits[loc.id].records.push({
        ...loc,
        hasOverlap
      })
    })

    return (
      <div style={{ maxWidth: 600 }}>
        <BCTypography
          variant="body"
          fontWeight="bold"
          gutterBottom
          component="div"
        >
          {firstLoc.name}
        </BCTypography>

        <BCTypography variant="body" component="div" gutterBottom>
          <strong>Total Supply Units:</strong>{' '}
          {Object.keys(uniqueSupplyUnits).length}
        </BCTypography>

        {!isInBC && (
          <BCTypography variant="body" sx={{ color: 'red' }} component="p">
            🚨 Outside BC!
          </BCTypography>
        )}

        <BCTypography
          variant="body"
          mt={2}
          fontWeight="bold"
          component="div"
          gutterBottom
        >
          Supply Units at this location:
        </BCTypography>
        <ExcelStyledTable
          uniqueSupplyUnits={uniqueSupplyUnits}
          overlapMap={overlapMap}
        />

        <BCTypography variant="body" component="div" sx={{ mt: 2 }}>
          Coordinates: {firstLoc.lat.toFixed(4)}, {firstLoc.lng.toFixed(4)}
        </BCTypography>
      </div>
    )
  }

  // Component for Geofencing Status
  const GeofencingStatus = () => {
    if (geofencingStatus === 'loading') {
      return (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          icon={<CircularProgress size={24} />}
        >
          <BCTypography variant="subtitle1" fontWeight="bold">
            Geofencing in progress...
          </BCTypography>
          <BCTypography variant="body2">
            Checking each location to determine if it&apos;s inside BC&apos;s
            boundaries.
          </BCTypography>
        </Alert>
      )
    }

    if (geofencingStatus === 'error') {
      return (
        <Alert severity="error" sx={{ mb: 2 }}>
          <BCTypography variant="subtitle1" fontWeight="bold">
            Geofencing error
          </BCTypography>
          <BCTypography variant="body2">
            There was an error checking location boundaries. Using fallback
            method.
          </BCTypography>
        </Alert>
      )
    }

    return null
  }

  // Summary of overlapping periods
  const OverlapSummary = () => {
    if (geofencingStatus !== 'completed') return null
    console.log('Overlap stats:', overlapStats)
    return (
      <Alert
        severity={overlapStats.overlapping > 0 ? 'warning' : 'success'}
        sx={{ mb: 2 }}
      >
        <BCTypography variant="subtitle1" fontWeight="bold" gutterBottom>
          {overlapStats.overlapping > 0
            ? 'Period Overlaps Detected'
            : 'No Period Overlaps'}
        </BCTypography>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px'
          }}
        >
          <BCTypography variant="body2">
            <strong>Total Supply Units:</strong> {overlapStats.total}
          </BCTypography>
          <BCTypography variant="body2">
            <strong>Units with Overlaps:</strong> {overlapStats.overlapping}
          </BCTypography>
          <BCTypography variant="body2">
            <strong>Units without Overlaps:</strong>{' '}
            {overlapStats.nonOverlapping}
          </BCTypography>
          <BCTypography variant="body2">
            <strong>BC Units with Overlaps:</strong>{' '}
            {overlapStats.bcOverlapping}
          </BCTypography>
          <BCTypography variant="body2">
            <strong>Outside BC with Overlaps:</strong>{' '}
            {overlapStats.nonBcOverlapping}
          </BCTypography>
        </div>
      </Alert>
    )
  }

  if (isLoading)
    return (
      <Alert
        severity="info"
        icon={<CircularProgress size={24} />}
        sx={{ mb: 2 }}
      >
        Loading map data...
      </Alert>
    )

  if (isError || error)
    return (
      <div>
        <Alert severity="error" sx={{ mb: 2 }}>
          <BCTypography variant="subtitle1" fontWeight="bold">
            Error: {error?.message || 'Failed to load data'}
          </BCTypography>
          <BCTypography variant="body2">
            Please ensure the API provides location data with latitude,
            longitude, and date fields.
          </BCTypography>
        </Alert>
        <BCButton
          variant="outlined"
          color="dark"
          onClick={() => {
            refetch()
            setGeofencingStatus('idle')
          }}
          sx={{ mb: 2 }}
        >
          Refresh Map Data
        </BCButton>
      </div>
    )

  if (
    !supplyEquipmentData ||
    !supplyEquipmentData.finalSupplyEquipments ||
    supplyEquipmentData.finalSupplyEquipments.length === 0
  )
    return (
      <div>
        <Alert severity="warning" sx={{ mb: 2 }}>
          <BCTypography variant="subtitle1" fontWeight="bold">
            No location data found
          </BCTypography>
          <BCTypography variant="body2">
            API should return data with the following fields:
          </BCTypography>
          <ul style={{ marginLeft: 20 }}>
            <li>registrationNbr and serialNbr (for ID creation)</li>
            <li>streetAddress, city, postalCode (for location name)</li>
            <li>latitude and longitude</li>
            <li>supplyFromDate and supplyToDate</li>
          </ul>
        </Alert>
        <BCButton
          variant="outlined"
          color="dark"
          onClick={() => {
            refetch()
            setGeofencingStatus('idle')
          }}
          sx={{ mb: 2 }}
        >
          Refresh Map Data
        </BCButton>
      </div>
    )

  return (
    <div>
      <BCButton
        variant="outlined"
        color="dark"
        size="small"
        onClick={() => {
          refetch()
          setGeofencingStatus('idle')
        }}
        sx={{ mb: 2 }}
      >
        Refresh Map Data
      </BCButton>

      <GeofencingStatus />

      {/* {geofencingStatus === 'completed' && <OverlapSummary />} */}

      <Paper
        elevation={3}
        sx={{ height: 600, width: '100%', overflow: 'hidden' }}
      >
        <MapContainer
          center={[53.7267, -127.6476]}
          zoom={5}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapBoundsHandler groupedLocations={groupedLocations} />
          <MapLegend geofencingStatus={geofencingStatus} />

          {Object.entries(groupedLocations).map(([coordKey, locGroup]) => {
            const firstLoc = locGroup[0]
            const position = [firstLoc.lat, firstLoc.lng]

            // Determine marker icon based on geofencing results and overlap status
            let icon = markerIcons.grey // Default to loading icon

            if (geofencingStatus === 'completed') {
              const isInBC = geofencingResults[firstLoc.id]

              const hasAnyOverlaps = locGroup.some(
                (loc) =>
                  overlapMap[loc.uniqueId] &&
                  overlapMap[loc.uniqueId].length > 0
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
        </MapContainer>
      </Paper>
    </div>
  )
}

export default MapComponent
