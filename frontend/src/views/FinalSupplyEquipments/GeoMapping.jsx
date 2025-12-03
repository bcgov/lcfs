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
  findOverlappingPeriods
} from './components/utils'
import { useLocationService } from '@/services/locationService'

// Fix Leaflet icon issue
fixLeafletIcons()

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24
const DEFAULT_OPERATIONAL_HOURS = 24

const normalizeNumber = (value) => {
  if (value === null || value === undefined) {
    return null
  }

  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const calculateInclusiveDays = (from, to) => {
  if (!from || !to) {
    return null
  }

  const start = new Date(from)
  const end = new Date(to)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null
  }

  const days = Math.floor((end.getTime() - start.getTime()) / MILLISECONDS_PER_DAY) + 1
  return days > 0 ? days : null
}

const calculateLocationMetrics = (locGroup = []) => {
  const equipmentIds = new Set()
  const equipmentPower = new Map()
  let sumOperationalDays = 0
  let operationalDaySamples = 0
  let sumKwhUsage = 0
  let hasUsageData = false

  locGroup.forEach((loc) => {
    equipmentIds.add(loc.id)

    const operationalDays = calculateInclusiveDays(
      loc.supplyFromDate,
      loc.supplyToDate
    )
    if (operationalDays !== null) {
      sumOperationalDays += operationalDays
      operationalDaySamples += 1
    }

    const powerOutput = normalizeNumber(loc.powerOutput)
    if (powerOutput !== null && powerOutput > 0) {
      equipmentPower.set(loc.id, powerOutput)
    }

    const kwhUsage = normalizeNumber(loc.kwhUsage)
    if (kwhUsage !== null) {
      sumKwhUsage += kwhUsage
      hasUsageData = true
    }
  })

  const equipmentCount = equipmentIds.size
  const averageOperationalDays =
    operationalDaySamples > 0
      ? sumOperationalDays / operationalDaySamples
      : null

  const averagePowerOutput =
    equipmentPower.size > 0
      ? Array.from(equipmentPower.values()).reduce(
          (sum, value) => sum + value,
          0
        ) / equipmentPower.size
      : null

  const maxCapacity =
    equipmentCount > 0 &&
    averageOperationalDays !== null &&
    averagePowerOutput !== null
      ? equipmentCount *
        averagePowerOutput *
        DEFAULT_OPERATIONAL_HOURS *
        averageOperationalDays
      : null

  const reportedKwhUsage = hasUsageData ? sumKwhUsage : null

  const utilization =
    maxCapacity &&
    maxCapacity > 0 &&
    reportedKwhUsage !== null
      ? (reportedKwhUsage / maxCapacity) * 100
      : null

  return {
    equipmentCount,
    averageOperationalDays,
    operationalHours: DEFAULT_OPERATIONAL_HOURS,
    averagePowerOutput,
    maxCapacity,
    reportedKwhUsage,
    utilization
  }
}

const formatNumber = (value, options = {}) => {
  if (value === null || value === undefined) {
    return null
  }

  return new Intl.NumberFormat('en-CA', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
    ...options
  }).format(value)
}

const GeoMapping = ({ complianceReportId, data }) => {
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

  // Use the location service for geofencing
  const { batchProcessGeofencing } = useLocationService()

  // Reset geofencing status
  const resetGeofencing = () => setGeofencingStatus('idle')

  // Process API data when it loads
  useEffect(() => {
    if (data) {
      const transformedData = transformApiData(data)

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
  }, [data])

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
          fseId: loc.chargingEquipmentId,
          serialNum: loc.serialNumber,
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

    const locationMetrics = calculateLocationMetrics(locGroup)
    const equipmentCount =
      locationMetrics.equipmentCount ??
      Object.keys(uniqueSupplyUnits).length
    const formattedAverageOperationalDays = formatNumber(
      locationMetrics.averageOperationalDays,
      { maximumFractionDigits: 2 }
    )
    const formattedAveragePower = formatNumber(
      locationMetrics.averagePowerOutput
    )
    const formattedMaxCapacity = formatNumber(locationMetrics.maxCapacity)
    const formattedReportedUsage = formatNumber(
      locationMetrics.reportedKwhUsage
    )
    const formattedUtilization = formatNumber(locationMetrics.utilization, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0
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
          <strong>Number of Equipments (FSE):</strong> {equipmentCount}
        </BCTypography>

        <BCTypography variant="body" mt={1} fontWeight="bold" component="div">
          Map Location Details
        </BCTypography>
        <div style={{ lineHeight: 1.6 }}>
          <BCTypography variant="body" component="div">
            <strong>Average operational days:</strong>{' '}
            {formattedAverageOperationalDays ?? 'N/A'}
          </BCTypography>
          <BCTypography variant="body" component="div">
            <strong>Operational hours (per day):</strong>{' '}
            {locationMetrics.operationalHours} hrs
          </BCTypography>
          <BCTypography variant="body" component="div">
            <strong>Average power output:</strong>{' '}
            {formattedAveragePower !== null
              ? `${formattedAveragePower} kW`
              : 'N/A'}
          </BCTypography>
          <BCTypography variant="body" component="div">
            <strong>Max value (FSE × power × hours × avg days):</strong>{' '}
            {formattedMaxCapacity !== null
              ? `${formattedMaxCapacity} kWh`
              : 'N/A'}
          </BCTypography>
          <BCTypography variant="body" component="div">
            <strong>Reported kWh usage:</strong>{' '}
            {formattedReportedUsage !== null
              ? `${formattedReportedUsage} kWh`
              : 'N/A'}
          </BCTypography>
          <BCTypography variant="body" component="div">
            <strong>Utilization:</strong>{' '}
            {formattedUtilization !== null
              ? `${formattedUtilization}%`
              : 'N/A'}
          </BCTypography>
        </div>

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

  if (error) {
    return <ErrorState error={error} resetGeofencing={resetGeofencing} />
  }

  if (
    !data ||
    !data.finalSupplyEquipments ||
    data.finalSupplyEquipments.length === 0
  )
    return <NoDataState resetGeofencing={resetGeofencing} />

  return (
    <div>
      <BCButton
        variant="outlined"
        color="dark"
        size="small"
        onClick={() => {
          setGeofencingStatus('idle')
        }}
        sx={{ mb: 2 }}
      >
        Reset Geofencing
      </BCButton>

      <GeofencingStatus status={geofencingStatus} />
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
