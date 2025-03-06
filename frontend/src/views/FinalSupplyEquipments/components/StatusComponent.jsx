import { Alert, CircularProgress } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'

// Geofencing Status component
export const GeofencingStatus = ({ status }) => {
  if (status === 'loading') {
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

  if (status === 'error') {
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
export const OverlapSummary = ({ overlapStats }) => {
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
          <strong>Units without Overlaps:</strong> {overlapStats.nonOverlapping}
        </BCTypography>
        <BCTypography variant="body2">
          <strong>BC Units with Overlaps:</strong> {overlapStats.bcOverlapping}
        </BCTypography>
        <BCTypography variant="body2">
          <strong>Outside BC with Overlaps:</strong>{' '}
          {overlapStats.nonBcOverlapping}
        </BCTypography>
      </div>
    </Alert>
  )
}

// Loading and error states
export const LoadingState = () => (
  <Alert severity="info" icon={<CircularProgress size={24} />} sx={{ mb: 2 }}>
    Loading map data...
  </Alert>
)

export const ErrorState = ({ error, refetch, resetGeofencing }) => (
  <div>
    <Alert severity="error" sx={{ mb: 2 }}>
      <BCTypography variant="subtitle1" fontWeight="bold">
        Error: {error?.message || 'Failed to load data'}
      </BCTypography>
      <BCTypography variant="body2">
        Please ensure the API provides location data with latitude, longitude,
        and date fields.
      </BCTypography>
    </Alert>
    <BCButton
      variant="outlined"
      color="dark"
      onClick={() => {
        refetch()
        resetGeofencing()
      }}
      sx={{ mb: 2 }}
    >
      Refresh Map Data
    </BCButton>
  </div>
)

export const NoDataState = ({ refetch, resetGeofencing }) => (
  <div>
    <Alert severity="warning" sx={{ mb: 2 }}>
      <BCTypography variant="subtitle1" fontWeight="bold">
        No location data found
      </BCTypography>
      <BCTypography variant="body2">
        API should return data with the following fields:
      </BCTypography>
      <ul style={{ marginLeft: 20 }}>
        <li>serialNbr (for ID creation)</li>
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
        resetGeofencing()
      }}
      sx={{ mb: 2 }}
    >
      Refresh Map Data
    </BCButton>
  </div>
)
