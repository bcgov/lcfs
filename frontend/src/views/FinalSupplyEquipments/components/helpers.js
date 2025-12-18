/**
 * @file helpers.js
 * @description Helper functions for FSE data transformation and formatting
 */
import { STATUS_CONFIG, CHARGING_LEVELS } from './constants'
import { markerIcons } from './utils'

/**
 * Transforms API response into normalized equipment objects
 */
export const transformData = (data) => {
  if (!data?.finalSupplyEquipments) return []

  const normalizeAddressField = (item) =>
    item.streetAddress ||
    item.street_address ||
    item.address ||
    item.siteAddress ||
    item.site_address ||
    null

  const normalizeCityField = (item) =>
    item.city ||
    item.town ||
    item.locality ||
    item.siteCity ||
    item.site_city ||
    null

  const normalizeProvinceField = (item) =>
    item.province ||
    item.provinceState ||
    item.state ||
    item.siteProvince ||
    item.site_province ||
    null

  const normalizePostalField = (item) =>
    item.postalCode ||
    item.postal_code ||
    item.sitePostalCode ||
    item.site_postal_code ||
    null

  return data.finalSupplyEquipments
    .map((item) => ({
      id: item.chargingEquipmentId || item.charging_equipment_id,
      siteId: item.chargingSiteId || item.charging_site_id,
      siteName: item.siteName || item.site_name || item.chargingSiteName,
      organization: item.organizationName || item.organization_name,
      lat: parseFloat(item.latitude) || 0,
      lng: parseFloat(item.longitude) || 0,
      siteLat: parseFloat(item.siteLatitude || item.site_latitude) || null,
      siteLng: parseFloat(item.siteLongitude || item.site_longitude) || null,
      regNumber:
        item.registrationNumber ||
        item.registration_number ||
        item.equipmentNumber,
      serial: item.serialNumber || item.serial_number,
      manufacturer: item.manufacturer,
      model: item.model,
      level:
        item.levelOfEquipmentName ||
        item.levelOfEquipment ||
        item.level_of_equipment,
      ports: item.ports,
      status: item.status || 'Draft',
      intendedUses: item.intendedUses || item.intended_uses || [],
      intendedUsers: item.intendedUsers || item.intended_users || [],
      streetAddress: normalizeAddressField(item),
      city: normalizeCityField(item),
      province: normalizeProvinceField(item),
      postalCode: normalizePostalField(item),
      capacityKw:
        item.capacityKw ||
        item.capacity_kw ||
        item.maxPowerKw ||
        item.max_power_kw ||
        null
    }))
    .filter(
      (loc) =>
        loc.lat !== 0 &&
        loc.lng !== 0 &&
        !isNaN(loc.lat) &&
        !isNaN(loc.lng) &&
        Math.abs(loc.lat) <= 90 &&
        Math.abs(loc.lng) <= 180
    )
}

/**
 * Groups equipment by charging site and calculates site-level aggregates
 */
export const groupBySite = (locations) => {
  const grouped = {}

  locations.forEach((loc) => {
    const key = loc.siteId || `${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`
    if (!grouped[key]) {
      grouped[key] = {
        key,
        items: [],
        siteName: loc.siteName,
        siteId: loc.siteId,
        organization: loc.organization,
        streetAddress: loc.streetAddress,
        city: loc.city,
        province: loc.province,
        postalCode: loc.postalCode,
        siteLat: loc.siteLat,
        siteLng: loc.siteLng
      }
    }
    const group = grouped[key]
    group.items.push(loc)

    // Backfill missing data from equipment
    if (!group.siteLat && loc.siteLat) group.siteLat = loc.siteLat
    if (!group.siteLng && loc.siteLng) group.siteLng = loc.siteLng
    if (!group.streetAddress && loc.streetAddress)
      group.streetAddress = loc.streetAddress
    if (!group.city && loc.city) group.city = loc.city
    if (!group.province && loc.province) group.province = loc.province
    if (!group.postalCode && loc.postalCode) group.postalCode = loc.postalCode
  })

  Object.values(grouped).forEach((group) => {
    const fallback = group.items[0] || { lat: 0, lng: 0 }
    group.lat = group.siteLat || fallback.lat
    group.lng = group.siteLng || fallback.lng

    // Calculate total capacity
    group.totalCapacity = group.items.reduce((sum, item) => {
      const value = Number(item.capacityKw)
      return !Number.isNaN(value) && value > 0 ? sum + value : sum
    }, 0)

    // Determine site status from equipment statuses
    const statusCounts = group.items.reduce((acc, item) => {
      const status = item.status || 'Draft'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})

    const statuses = Object.keys(statusCounts)
    if (statuses.length === 0) {
      group.status = 'Draft'
    } else if (statuses.length === 1) {
      group.status = statuses[0]
    } else {
      // Mixed statuses: use most common
      group.status = Object.entries(statusCounts).sort(
        (a, b) => b[1] - a[1]
      )[0][0]
    }
  })

  return grouped
}

/**
 * Builds formatted address string
 */
export const buildAddressLine = (data) => {
  if (!data) return null
  const parts = [
    data.streetAddress,
    [data.city, data.province].filter(Boolean).join(', '),
    data.postalCode
  ]
    .map((part) => part && String(part).trim())
    .filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

/**
 * Formats coordinates for display
 */
export const formatCoordinates = (lat, lng, precision = 6) =>
  `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`

/**
 * Gets charging level display info
 */
export const getLevelInfo = (level) => {
  if (!level) return { short: '—', full: 'Unknown' }
  const lower = level.toLowerCase()
  for (const [key, value] of Object.entries(CHARGING_LEVELS)) {
    if (key.toString().toLowerCase() === lower) return value
  }
  return { short: level, full: level }
}

/**
 * Gets marker icon based on status
 */
export const getMarkerIconForStatus = (status) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.Draft
  return markerIcons[config.markerColor] || markerIcons.grey
}

/**
 * Generates URL for site details
 */
export const getSiteUrl = (siteId) => {
  if (!siteId) return null
  return `/compliance-reporting/charging-sites/${siteId}`
}

/**
 * Generates URL for equipment details
 */
export const getEquipmentUrl = (equipmentId) => {
  if (!equipmentId) return null
  return `/compliance-reporting/fse/${equipmentId}/edit`
}
