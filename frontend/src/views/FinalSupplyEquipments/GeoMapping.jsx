import { useState, useEffect } from 'react'
import { MapContainer } from 'react-leaflet'
import { Paper } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import 'leaflet/dist/leaflet.css'

// Import custom components
import {
  BaseMap,
  MapBoundsHandler,
  MapLegend,
  MapMarkers
} from './components/MapComponents'
import {
  GeofencingStatus,
  OverlapSummary,
  LoadingState,
  ErrorState,
  NoDataState
} from './components/StatusComponent'
import { ExcelStyledTable } from './components/TableComponent'
// Import utility functions and services
import {
  fixLeafletIcons,
  transformApiData,
  groupLocationsByCoordinates,
  findOverlappingPeriods,
  batchProcessGeofencing
} from './components/utils'
import { useGetFinalSupplyEquipments } from '@/hooks/useFinalSupplyEquipment'

// Fix Leaflet icon issue
fixLeafletIcons()

const GeoMapping = ({ complianceReportId }) => {
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

  // Use react-query for fetching data
  const {
    data: supplyEquipmentData,
    isLoading,
    isError,
    refetch
  } = useGetFinalSupplyEquipments(complianceReportId)

  // Reset geofencing status
  const resetGeofencing = () => setGeofencingStatus('idle')

  // Process API data when it loads
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
  }, [supplyEquipmentData])

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

  if (isLoading) {
    return <LoadingState />
  }

  if (isError || error) {
    return (
      <ErrorState
        error={error}
        refetch={refetch}
        resetGeofencing={resetGeofencing}
      />
    )
  }

  if (
    !supplyEquipmentData ||
    !supplyEquipmentData.finalSupplyEquipments ||
    supplyEquipmentData.finalSupplyEquipments.length === 0
  )
    return <NoDataState refetch={refetch} resetGeofencing={resetGeofencing} />

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
      {/* {geofencingStatus === 'completed' && (
        <OverlapSummary overlapStats={overlapStats} />
      )} */}
      <Paper
        elevation={3}
        sx={{ height: 600, width: '100%', overflow: 'hidden' }}
      >
        <MapContainer
          center={[53.7267, -127.6476]}
          zoom={5}
          style={{ height: '100%', width: '100%' }}
        >
          <BaseMap />
          <MapBoundsHandler groupedLocations={groupedLocations} />
          <MapLegend geofencingStatus={geofencingStatus} />
          <MapMarkers
            groupedLocations={groupedLocations}
            geofencingStatus={geofencingStatus}
            geofencingResults={geofencingResults}
            overlapMap={overlapMap}
            generatePopupContent={generatePopupContent}
          />
        </MapContainer>
      </Paper>
    </div>
  )
}

export default GeoMapping
