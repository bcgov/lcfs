import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import BCBox from '@/components/BCBox'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { ROUTES } from '@/routes/routes'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { govRoles } from '@/constants/roles'
import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Autocomplete, Box, Grid, Stack, TextField } from '@mui/material'
import { useOrganizationNames } from '@/hooks/useOrganizations'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import {
  indexChargingSitesColDefs,
  indexDefaultColDef
} from './components/_schema'
import { useGetAllChargingSites } from '@/hooks/useChargingSite'
import ChargingSitesMap from './components/ChargingSitesMap'

export const ChargingSitesList = ({ alertRef }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation(['chargingSite'])
  const { data: currentUser, hasAnyRole } = useCurrentUser()
  const isIDIR = hasAnyRole(...govRoles)
  const gridRef = useRef(null)

  // Enhanced state management with caching
  const [selectedOrg, setSelectedOrg] = useState(() => {
    // Try to restore from sessionStorage on initial load
    const cached = sessionStorage.getItem('selectedOrganization')
    if (cached) {
      try {
        return JSON.parse(cached)
      } catch (e) {
        return { id: null, label: null }
      }
    }
    return { id: null, label: null }
  })

  const [paginationOptions, setPaginationOptions] = useState({
    page: 1,
    size: 10,
    sortOrders: [],
    filters: []
  })

  const handleNewSite = () => {
    navigate(ROUTES.REPORTS.CHARGING_SITE.ADD)
  }

  const organizationId = currentUser?.organization?.organizationId
  const isOnNestedRoute = location.pathname !== ROUTES.REPORTS.CHARGING_SITE

  const { data: orgNames = [], isLoading: orgLoading } = useOrganizationNames(
    null,
    { enabled: isIDIR }
  )

  const orgIdToName = useMemo(() => {
    try {
      return Object.fromEntries(
        (orgNames || []).map((o) => [o.organizationId, o.name])
      )
    } catch (e) {
      return {}
    }
  }, [orgNames])

  const idirColumnDefs = useMemo(
    () => indexChargingSitesColDefs(isIDIR, orgIdToName),
    [orgIdToName]
  )

  const queryData = useGetAllChargingSites(
    paginationOptions,
    isIDIR,
    organizationId,
    {
      enabled: true
    }
  )

  // Enhanced organization change handler with caching
  const handleOrganizationChange = useCallback((event, option) => {
    const id = option?.organizationId || null
    const label = option?.name || null
    const newSelectedOrg = { id, label }

    // Update state
    setSelectedOrg(newSelectedOrg)

    // Cache the selection in sessionStorage
    if (id && label) {
      sessionStorage.setItem(
        'selectedOrganization',
        JSON.stringify(newSelectedOrg)
      )
    } else {
      sessionStorage.removeItem('selectedOrganization')
    }

    // Update pagination options with new filter
    setPaginationOptions((prev) => ({
      ...prev,
      page: 1,
      filters: id
        ? [
            {
              field: 'organizationId',
              filterType: 'number',
              type: 'equals',
              filter: id
            }
          ]
        : []
    }))
  }, [])

  const handleClearFilters = useCallback(() => {
    setPaginationOptions({ page: 1, size: 10, sortOrders: [], filters: [] })
    setSelectedOrg({ id: null, label: null })

    // Clear cached selection
    sessionStorage.removeItem('selectedOrganization')

    try {
      gridRef.current?.clearFilters?.()
    } catch (e) {
      // no-op
    }
  }, [])

  // Find the selected organization object for the Autocomplete value
  const selectedOrgOption = useMemo(() => {
    if (!selectedOrg.id || !orgNames.length) return null
    return orgNames.find((org) => org.organizationId === selectedOrg.id) || null
  }, [selectedOrg.id, orgNames])

  // Apply cached filter when component mounts and org data is loaded
  useEffect(() => {
    if (selectedOrg.id && orgNames.length > 0) {
      // Verify the cached organization still exists
      const orgExists = orgNames.some(
        (org) => org.organizationId === selectedOrg.id
      )
      if (orgExists) {
        setPaginationOptions((prev) => ({
          ...prev,
          page: 1,
          filters: [
            {
              field: 'organizationId',
              filterType: 'number',
              type: 'equals',
              filter: selectedOrg.id
            }
          ]
        }))
      } else {
        // Clear invalid cached selection
        setSelectedOrg({ id: null, label: null })
        sessionStorage.removeItem('selectedOrganization')
      }
    }
  }, [selectedOrg.id, orgNames])

  return (
    <>
      <>
        <BCTypography variant="h5" color="primary">
          {isIDIR ? t('chargingSitesTitle') : t('mngTitle')}
        </BCTypography>
        <BCTypography variant="body2" color="text.secondary" my={2}>
          {isIDIR ? t('csDescription') : t('mngCSdescription')}
        </BCTypography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} lg={7}>
            <Stack spacing={1} direction={'row'}>
              {!isIDIR && (
                <BCButton
                  id="new-site-button"
                  variant="contained"
                  size="small"
                  color="primary"
                  onClick={handleNewSite}
                >
                  <BCTypography variant="subtitle2">
                    {t('newSiteBtn')}
                  </BCTypography>
                </BCButton>
              )}
              <ClearFiltersButton onClick={handleClearFilters} />
            </Stack>
          </Grid>
          {isIDIR && (
            <Grid
              item
              xs={12}
              lg={5}
              sx={{
                display: 'flex',
                justifyContent: { xs: 'flex-start', lg: 'flex-end' },
                alignItems: 'center'
              }}
            >
              <Box display="flex" alignItems="center" gap={1}>
                <BCTypography variant="body2" color="primary">
                  {t('filtersLabel')}
                </BCTypography>
                <Autocomplete
                  disablePortal
                  id="idir-orgs"
                  loading={orgLoading}
                  options={orgNames}
                  value={selectedOrgOption}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, value) =>
                    option.organizationId === value.organizationId
                  }
                  onChange={handleOrganizationChange}
                  sx={({ functions: { pxToRem } }) => ({
                    width: 300,
                    '& .MuiOutlinedInput-root': { padding: pxToRem(0) }
                  })}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder={t(
                        'selectOrgPlaceholder',
                        'Select organization'
                      )}
                      slotProps={{
                        htmlInput: {
                          ...params.inputProps,
                          style: { fontSize: 16, padding: '8px' }
                        }
                      }}
                    />
                  )}
                />
              </Box>
            </Grid>
          )}
        </Grid>
        <BCBox component="div" sx={{ mt: 2, height: '100%', width: '100%' }}>
          <BCGridViewer
            gridRef={gridRef}
            gridKey="idir-charging-sites-grid"
            columnDefs={idirColumnDefs}
            defaultColDef={indexDefaultColDef}
            queryData={queryData}
            dataKey="chargingSites"
            autoSizeStrategy={{ type: 'fitGridWidth', defaultMinWidth: 80 }}
            paginationOptions={paginationOptions}
            onPaginationChange={setPaginationOptions}
            getRowId={(p) => String(p.data?.chargingSiteId || p.node?.id)}
          />
        </BCBox>
        <ChargingSitesMap
          sites={queryData?.data?.chargingSites || []}
          showLegend={false}
          height={500}
        />
      </>
      <Outlet />
    </>
  )
}
