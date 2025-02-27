import React, { useEffect, useState, useCallback } from 'react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useGetFinalSupplyEquipments } from '@/hooks/useFinalSupplyEquipment'

// Fix Leaflet's default icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png'
})

// Custom marker for locations outside BC
const outsideBCIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
})

// Custom marker for locations with overlapping periods
const overlapIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
})

// Loading status icon
const loadingIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
})

// Geofencing approach using Nominatim for reverse geocoding
const checkLocationInBC = async (lat, lng) => {
  try {
    // Using OpenStreetMap's Nominatim service for reverse geocoding
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

    // Process this batch in parallel
    const batchPromises = batch.map(async (loc) => {
      const isInBC = await checkLocationInBC(loc.lat, loc.lng)
      return { id: loc.id, isInBC }
    })

    const batchResults = await Promise.all(batchPromises)

    // Add batch results to the overall results
    batchResults.forEach(({ id, isInBC }) => {
      results[id] = isInBC
    })

    // Add a small delay to avoid rate limiting
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
  // Extract the base ID (registrationNbr) from the combined ID
  const currentRegNum = currentLoc.id.split('_')[0]
  const currentSerialNum = currentLoc.id.split('_')[1]

  return allLocations
    .filter((loc) => {
      // Split the comparison location's ID
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
    // Create a key based on coordinates (rounded to reduce floating point issues)
    const key = `${location.lat.toFixed(6)},${location.lng.toFixed(6)}`

    if (!grouped[key]) {
      grouped[key] = []
    }

    grouped[key].push(location)
  })

  return grouped
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
        id: combinedId,
        // Add a unique identifier for this specific record
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

  // Update locations when data changes
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

      // Start the geofencing process
      batchProcessGeofencing(uniqueLocations)
        .then((results) => {
          // Expand results to all locations with the same coordinates
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

      // Calculate overlaps
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

  // Initialize and update map
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (Object.keys(groupedLocations).length === 0) return

    let mapInstance = null
    const container = document.getElementById('map-container')
    if (!container) return

    // Initialize map - center it on a view that shows all of BC
    mapInstance = L.map('map-container').setView([53.7267, -127.6476], 5)

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapInstance)

    // Add markers for each location group
    const markers = {}

    Object.entries(groupedLocations).forEach(([coordKey, locGroup]) => {
      const firstLoc = locGroup[0]
      const locationCoords = [firstLoc.lat, firstLoc.lng]

      // Get unique registration/serial combinations at this location
      const uniqueSupplyUnits = {}
      locGroup.forEach((loc) => {
        if (!uniqueSupplyUnits[loc.id]) {
          uniqueSupplyUnits[loc.id] = {
            regNum: loc.registrationNbr,
            serialNum: loc.serialNbr,
            records: []
          }
        }
        uniqueSupplyUnits[loc.id].records.push(loc)
      })

      // Start with loading icon for all markers
      const marker = L.marker(locationCoords, {
        icon: loadingIcon
      }).addTo(mapInstance)

      // Store marker reference for updating later
      markers[coordKey] = marker

      // Create a popup showing all units at this location
      const popupContent = `
        <strong>${firstLoc.name}</strong><br>
        <b>Total Supply Units at this location:</b> ${
          Object.keys(uniqueSupplyUnits).length
        }<br>
        ${geofencingStatus === 'loading' ? '<p>Checking location...</p>' : ''}
      `

      marker.bindPopup(popupContent)
    })

    // Update markers when geofencing results are available
    if (
      geofencingStatus === 'completed' &&
      Object.keys(overlapMap).length > 0
    ) {
      Object.entries(groupedLocations).forEach(([coordKey, locGroup]) => {
        const marker = markers[coordKey]
        if (!marker) return

        const firstLoc = locGroup[0]
        const isInBC = geofencingResults[firstLoc.id]

        // Check if any locations in this group have overlaps
        const hasAnyOverlaps = locGroup.some(
          (loc) =>
            overlapMap[loc.uniqueId] && overlapMap[loc.uniqueId].length > 0
        )

        // Update marker icon based on geofencing and overlap status
        let markerIcon = new L.Icon.Default()
        if (!isInBC) {
          markerIcon = outsideBCIcon
        } else if (hasAnyOverlaps) {
          markerIcon = overlapIcon
        }

        marker.setIcon(markerIcon)

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

        // Create updated popup content
        let popupContent = `
          <strong>${firstLoc.name}</strong><br>
          <b>Total Supply Units at this location:</b> ${
            Object.keys(uniqueSupplyUnits).length
          }
          ${!isInBC ? '<p style="color: red">🚨 Outside BC!</p>' : ''}
        `

        // List all supply units with their IDs and periods
        popupContent += `
          <p><strong>Supply Units at this location:</strong></p>
          <div style="max-height: 200px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr>
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: left;">Reg #</th>
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: left;">Serial #</th>
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: left;">Periods</th>
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: left;">Status</th>
                </tr>
              </thead>
              <tbody>
        `

        Object.values(uniqueSupplyUnits).forEach((unit) => {
          const statusColor = unit.hasOverlap ? 'orange' : 'green'
          const statusIcon = unit.hasOverlap ? '⚠️' : '✓'
          const statusText = unit.hasOverlap ? 'Period overlap' : 'No overlap'

          // Sort periods by start date
          const sortedRecords = [...unit.records].sort(
            (a, b) => new Date(a.supplyFromDate) - new Date(b.supplyFromDate)
          )

          // Create a list of all periods for this unit
          const periodsHtml = sortedRecords
            .map((record) => {
              const dateStyle = record.hasOverlap
                ? 'color: orange; font-weight: bold;'
                : ''
              return `<div style="${dateStyle}">${record.supplyFromDate} → ${record.supplyToDate}</div>`
            })
            .join('')

          popupContent += `
            <tr>
              <td style="border: 1px solid #ddd; padding: 4px; vertical-align: top;">${unit.regNum}</td>
              <td style="border: 1px solid #ddd; padding: 4px; vertical-align: top;">${unit.serialNum}</td>
              <td style="border: 1px solid #ddd; padding: 4px; vertical-align: top;">
                ${periodsHtml}
              </td>
              <td style="border: 1px solid #ddd; padding: 4px; color: ${statusColor}; vertical-align: top;">
                ${statusIcon} ${statusText}
              </td>
            </tr>
          `

          // If there are overlaps, show details
          if (unit.hasOverlap) {
            // Get all records for this unit that have overlaps
            const recordsWithOverlaps = unit.records.filter(
              (record) =>
                overlapMap[record.uniqueId] &&
                overlapMap[record.uniqueId].length > 0
            )

            recordsWithOverlaps.forEach((record) => {
              popupContent += `
                <tr>
                  <td colspan="4" style="border: 1px solid #ddd; padding: 4px;">
                    <div style="margin-left: 10px;">
                      <p style="font-weight: bold">Details for period: ${record.supplyFromDate} → ${record.supplyToDate}</p>
                      <p style="color: orange; font-weight: bold">⚠️ Overlaps with:</p>
                      <ul style="margin-top: 5px; padding-left: 20px;">
              `

              overlapMap[record.uniqueId].forEach((overlap) => {
                popupContent += `
                  <li>
                    Period: ${overlap.supplyFromDate} → ${overlap.supplyToDate}
                  </li>
                `
              })

              popupContent += `
                      </ul>
                    </div>
                  </td>
                </tr>
              `
            })
          }
        })

        popupContent += `
              </tbody>
            </table>
          </div>
        `

        popupContent += `<p>Coordinates: ${firstLoc.lat.toFixed(
          4
        )}, ${firstLoc.lng.toFixed(4)}</p>`

        // Update the popup content
        marker.bindPopup(popupContent, {
          maxWidth: 400,
          maxHeight: 300
        })
      })
    }

    // Set bounds to show all markers
    const bounds = Object.values(groupedLocations).map((group) => [
      group[0].lat,
      group[0].lng
    ])
    if (bounds.length > 0) {
      mapInstance.fitBounds(bounds)
    }

    // Add legend to map
    const legend = L.control({ position: 'bottomright' })
    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'info legend')
      div.style.backgroundColor = 'white'
      div.style.padding = '10px'
      div.style.borderRadius = '5px'
      div.style.border = '1px solid #ccc'

      div.innerHTML = `
        <div style="margin-bottom: 5px"><strong>Legend</strong></div>
        ${
          geofencingStatus === 'loading'
            ? `
          <div style="margin-bottom: 5px">
            <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png" height="20"> 
            Checking location...
          </div>
        `
            : ''
        }
        <div style="margin-bottom: 5px">
          <img src="https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png" height="20"> 
          Inside BC, no overlaps
        </div>
        <div style="margin-bottom: 5px">
          <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png" height="20"> 
          Period overlap (same Reg# & Serial#)
        </div>
        <div>
          <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png" height="20"> 
          Outside BC
        </div>
      `
      return div
    }
    legend.addTo(mapInstance)

    // Cleanup function
    return () => {
      if (mapInstance) {
        mapInstance.remove()
      }
    }
  }, [groupedLocations, geofencingResults, geofencingStatus, overlapMap])

  // Geofencing status indicator
  const GeofencingStatus = () => {
    if (geofencingStatus === 'loading') {
      return (
        <div className="p-4 bg-blue-100 rounded my-4">
          <h3 className="font-bold mb-2">🔄 Geofencing in progress...</h3>
          <p>
            Checking each location to determine if it&apos;s inside BC&apos;s
            boundaries.
          </p>
        </div>
      )
    }

    if (geofencingStatus === 'error') {
      return (
        <div className="p-4 bg-red-100 rounded my-4">
          <h3 className="font-bold mb-2">❌ Geofencing error</h3>
          <p>
            There was an error checking location boundaries. Using fallback
            method.
          </p>
        </div>
      )
    }

    return null
  }

  // Summary of overlapping periods
  const OverlapSummary = () => {
    if (geofencingStatus !== 'completed') return null

    return (
      <div
        className={`p-4 ${
          overlapStats.overlapping > 0 ? 'bg-orange-100' : 'bg-green-100'
        } rounded my-4`}
      >
        <h3 className="font-bold mb-2">
          {overlapStats.overlapping > 0
            ? '⚠️ Period Overlaps Detected'
            : '✓ No Period Overlaps'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p>
              <strong>Total Supply Units:</strong> {overlapStats.total}
            </p>
            <p>
              <strong>Units with Overlaps:</strong> {overlapStats.overlapping}
            </p>
            <p>
              <strong>Units without Overlaps:</strong>{' '}
              {overlapStats.nonOverlapping}
            </p>
          </div>
          <div>
            <p>
              <strong>BC Units with Overlaps:</strong>{' '}
              {overlapStats.bcOverlapping}
            </p>
            <p>
              <strong>Outside BC with Overlaps:</strong>{' '}
              {overlapStats.nonBcOverlapping}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show refresh button
  const RefreshButton = () => (
    <button
      onClick={() => {
        refetch()
        setGeofencingStatus('idle')
      }}
      className="px-4 py-2 bg-blue-500 text-white rounded mb-4 hover:bg-blue-600"
    >
      Refresh Map Data
    </button>
  )

  if (isLoading) return <p>Loading map data...</p>
  if (isError || error)
    return (
      <div>
        <p className="text-red-500">
          Error: {error?.message || 'Failed to load data'}
        </p>
        <p>
          Please ensure the API provides location data with latitude, longitude,
          and date fields.
        </p>
        <RefreshButton />
      </div>
    )

  if (
    !supplyEquipmentData ||
    !supplyEquipmentData.finalSupplyEquipments ||
    supplyEquipmentData.finalSupplyEquipments.length === 0
  )
    return (
      <div>
        <p>No location data found.</p>
        <p>API should return data with the following fields:</p>
        <ul className="list-disc ml-5 mt-2">
          <li>registrationNbr and serialNbr (for ID creation)</li>
          <li>streetAddress, city, postalCode (for location name)</li>
          <li>latitude and longitude</li>
          <li>supplyFromDate and supplyToDate</li>
        </ul>
        <RefreshButton />
      </div>
    )

  return (
    <div>
      <RefreshButton />
      <GeofencingStatus />
      {/* {geofencingStatus === 'completed' && <OverlapSummary />} */}
      <div id="map-container" style={{ height: '600px', width: '100%' }}></div>
    </div>
  )
}

export default MapComponent
