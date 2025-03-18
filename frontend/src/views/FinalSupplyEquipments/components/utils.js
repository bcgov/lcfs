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
  red: createMarkerIcon('red'),
  orange: createMarkerIcon('orange'),
  grey: createMarkerIcon('grey')
}

// Check if date ranges overlap between two locations
export const datesOverlap = (start1, end1, start2, end2) => {
  const s1 = new Date(start1)
  const e1 = new Date(end1)
  const s2 = new Date(start2)
  const e2 = new Date(end2)

  return s1 <= e2 && s2 <= e1
}

// Transform API data to match the expected format
export const transformApiData = (data) => {
  if (!data || !data.finalSupplyEquipments) return []

  return data.finalSupplyEquipments.map((row, index) => {
    // Create a combined ID from finalSupplyEquipmentId and serialNbr
    const finalSupplyEquipmentId = row.finalSupplyEquipmentId || 'unknown'
    const serialNbr = row.serialNbr || 'unknown'
    const combinedId = `${finalSupplyEquipmentId}_${serialNbr}`

    return {
      id: combinedId,
      uniqueId: `${combinedId}_${index}`,
      finalSupplyEquipmentId,
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
}

// Group locations by their coordinates
export const groupLocationsByCoordinates = (locations) => {
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

// Find all overlapping periods for a given location, only considering same ID
export const findOverlappingPeriods = (currentLoc, allLocations) => {
  const currentFseId = currentLoc.id.split('_')[0]
  const currentSerialNum = currentLoc.id.split('_')[1]

  return allLocations
    .filter((loc) => {
      const locFseId = loc.id.split('_')[0]
      const locSerialNum = loc.id.split('_')[1]

      // Only check for overlap if this is the same ID but different record
      return (
        currentLoc.uniqueId !== loc.uniqueId && // Different record
        currentFseId !== locFseId && // Same FSE-ID number
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
      fseId: loc.id.split('_')[0],
      serialNum: loc.id.split('_')[1],
      supplyFromDate: loc.supplyFromDate,
      supplyToDate: loc.supplyToDate
    }))
}

// Geofencing approach using Nominatim for reverse geocoding
export const checkLocationInBC = async (lat, lng) => {
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
export const batchProcessGeofencing = async (locations) => {
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

/**
 * Sorts an array of strings containing a mix of alphabets and numbers.
 * - Strings with prefixed numbers appear first
 * - Followed by alphabetical sorting (case insensitive)
 * - Numbers within or after alphabets do not affect sorting priority
 *
 * @param {string[]} arr - Array of strings to sort
 * @returns {string[]} - Sorted array
 */
export const sortMixedStrings = (arr) => {
  return arr.slice().sort((a, b) => {
    const aStartsWithNumber = /^\d/.test(a)
    const bStartsWithNumber = /^\d/.test(b)

    if (aStartsWithNumber && !bStartsWithNumber) {
      return -1
    }
    if (!aStartsWithNumber && bStartsWithNumber) {
      return 1 
    }

    if (aStartsWithNumber && bStartsWithNumber) {
      const aNumPrefix = parseInt(a.match(/^\d+/)[0])
      const bNumPrefix = parseInt(b.match(/^\d+/)[0])

      if (aNumPrefix !== bNumPrefix) {
        return aNumPrefix - bNumPrefix
      }

      const aRemainder = a.replace(/^\d+/, '')
      const bRemainder = b.replace(/^\d+/, '')
      return aRemainder.localeCompare(bRemainder, undefined, {
        sensitivity: 'base'
      })
    }

    const aMatch = a.match(/^(.*?)(\d+)$/)
    const bMatch = b.match(/^(.*?)(\d+)$/)

    if (aMatch && bMatch && aMatch[1] === bMatch[1]) {
      return parseInt(aMatch[2]) - parseInt(bMatch[2])
    }

    // Default: case insensitive alphabetical sort
    return a.localeCompare(b, undefined, { sensitivity: 'base' })
  })
}
