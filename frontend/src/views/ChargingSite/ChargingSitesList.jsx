import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import BCBox from '@/components/BCBox'
import { ROUTES } from '@/routes/routes'
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { govRoles } from '@/constants/roles'
import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Box, Grid, Stack } from '@mui/material'
import { useOrganizationNames } from '@/hooks/useOrganizations'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import {
  indexChargingSitesColDefs,
  indexDefaultColDef
} from './components/_schema'
import { useGetAllChargingSites } from '@/hooks/useChargingSite'
import ChargingSitesMap from './components/ChargingSitesMap'

const EXCLUDED_ORG_TYPES = new Set([
  'non_bceid_supplier',
  'exempted_supplier',
  'fuel_producer',
  'initiative_agreement_holder'
])

export const ChargingSitesList = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const outletContext = useOutletContext?.() || {}
  const alertRef = outletContext?.alertRef
  const { t } = useTranslation(['chargingSite'])
  const { data: currentUser, hasAnyRole } = useCurrentUser()
  const isIDIR = hasAnyRole(...govRoles)

  // Setup global navigation function for FSE processing
  useEffect(() => {
    if (isIDIR) {
      window.navigateToFSEProcessing = (siteId) => {
        navigate(
          ROUTES.CHARGING_SITES.EQUIPMENT_PROCESSING.replace(':siteId', siteId)
        )
      }
    }

    return () => {
      if (window.navigateToFSEProcessing) {
        delete window.navigateToFSEProcessing
      }
    }
  }, [navigate, isIDIR])
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

  useEffect(() => {
    if (!alertRef?.current || !location.state?.message) {
      return
    }

    alertRef.current.triggerAlert({
      message: location.state.message,
      severity: location.state.severity || 'success'
    })

    navigate(location.pathname, { replace: true })
  }, [alertRef, location.pathname, location.state, navigate])

  const handleNewSite = () => {
    navigate(ROUTES.REPORTS.CHARGING_SITE.ADD)
  }

  const organizationId = currentUser?.organization?.organizationId
  const isOnNestedRoute =
    location.pathname !== ROUTES.REPORTS.CHARGING_SITE.INDEX

  const { data: orgNames = [], isLoading: orgLoading } = useOrganizationNames(
    null,
    { orgFilter: 'all' },
    { enabled: isIDIR }
  )

  const filteredOrgNames = useMemo(
    () =>
      (orgNames || []).filter((org) => {
        const orgTypeKey = (org?.orgType || org?.org_type || '').toLowerCase()
        return !EXCLUDED_ORG_TYPES.has(orgTypeKey)
      }),
    [orgNames]
  )

  useEffect(() => {
    if (!selectedOrg.id) return
    const stillAvailable = filteredOrgNames.some(
      (org) => org.organizationId === selectedOrg.id
    )
    if (!stillAvailable) {
      setSelectedOrg({ id: null, label: null })
      sessionStorage.removeItem('selectedOrganization')
    }
  }, [filteredOrgNames, selectedOrg.id])

  const renderOrganizationOption = useCallback((props, option) => {
    const orgTypeLabel = option?.orgType || option?.org_type
    const formattedOrgType = orgTypeLabel
      ? orgTypeLabel
          .split('_')
          .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
          .join(' ')
      : null

    return (
      <li {...props}>
        <Box display="flex" flexDirection="column">
          <BCTypography variant="body2">{option?.name || ''}</BCTypography>
          {/* {formattedOrgType && (
            <BCTypography variant="caption" color="text.secondary">
              {formattedOrgType}
            </BCTypography>
          )} */}
        </Box>
      </li>
    )
  }, [])

  const onRowClicked = (params) => {
    navigate(
      ROUTES.REPORTS.CHARGING_SITE.VIEW.replace(
        ':siteId',
        params.data.chargingSiteId
      )
    )
  }

  const orgIdToName = useMemo(() => {
    try {
      return Object.fromEntries(
        (filteredOrgNames || []).map((o) => [o.organizationId, o.name])
      )
    } catch (e) {
      return {}
    }
  }, [filteredOrgNames])

  const idirColumnDefs = useMemo(
    () => indexChargingSitesColDefs(isIDIR, orgIdToName),
    [orgIdToName]
  )

  const apiPaginationOptions = useMemo(() => {
    const otherFilters = (paginationOptions?.filters || []).filter(
      (filter) => filter?.field !== 'organizationId'
    )

    const orgFilters =
      isIDIR && selectedOrg.id
        ? [
            {
              field: 'organizationId',
              filterType: 'number',
              type: 'equals',
              filter: selectedOrg.id
            }
          ]
        : []

    return {
      ...paginationOptions,
      filters: [...orgFilters, ...otherFilters]
    }
  }, [isIDIR, paginationOptions, selectedOrg.id])

  const queryData = useGetAllChargingSites(
    apiPaginationOptions,
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

    // Reset pagination but preserve existing grid filters
    setPaginationOptions((prev) => ({
      ...prev,
      page: 1
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
    if (!selectedOrg.id || !filteredOrgNames.length) return null
    return (
      filteredOrgNames.find((org) => org.organizationId === selectedOrg.id) ||
      null
    )
  }, [selectedOrg.id, filteredOrgNames])

  const filterToolbarConfig = useMemo(() => {
    if (!isIDIR) return null

    const selectFilters = [
      {
        id: 'organization',
        label: t('filtersLabel'),
        placeholder: t('selectOrgPlaceholder', 'Select organization'),
        value: selectedOrgOption,
        options: filteredOrgNames,
        onChange: (option) => handleOrganizationChange(null, option),
        getOptionLabel: (option) => option?.name || '',
        renderOption: renderOrganizationOption,
        isLoading: orgLoading,
        width: 320,
        isOptionEqualToValue: (option, value) =>
          option?.organizationId === value?.organizationId
      }
    ]

    const additionalPills =
      selectedOrg.id && selectedOrg.label
        ? [
            {
              id: `organization-${selectedOrg.id}`,
              label: t('common:Organization', 'Organization'),
              value: selectedOrg.label,
              type: 'select',
              onRemove: () => handleOrganizationChange(null, null)
            }
          ]
        : []

    return {
      selectFilters,
      additionalPills
    }
  }, [
    filteredOrgNames,
    handleOrganizationChange,
    isIDIR,
    orgLoading,
    renderOrganizationOption,
    selectedOrg.id,
    selectedOrg.label,
    selectedOrgOption,
    t
  ])

  // Show nested route component when on nested route
  if (isOnNestedRoute) {
    return <Outlet />
  }

  return (
    <>
      <BCTypography variant="h5" color="primary">
        {isIDIR ? t('chargingSitesTitle') : t('mngTitle')}
      </BCTypography>
      <BCTypography variant="body2" color="text.secondary" my={2}>
        {isIDIR ? t('csDescription') : t('mngCSdescription')}
      </BCTypography>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} lg={7}>
          <Stack spacing={1} direction="row">
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
          </Stack>
        </Grid>
      </Grid>
      <BCBox component="div" sx={{ mt: 2, height: '100%', width: '100%' }}>
        <BCGridViewer
          gridRef={gridRef}
          gridKey="idir-charging-sites-grid"
          onRowClicked={onRowClicked}
          columnDefs={idirColumnDefs}
          defaultColDef={indexDefaultColDef}
          queryData={queryData}
          dataKey="chargingSites"
          paginationOptions={paginationOptions}
          onPaginationChange={setPaginationOptions}
          getRowId={(p) => String(p.data?.chargingSiteId || p.node?.id)}
          filterToolbarConfig={filterToolbarConfig || undefined}
          onClearFilters={handleClearFilters}
        />
      </BCBox>
      <ChargingSitesMap
        sites={queryData?.data?.chargingSites || []}
        showLegend={false}
        height={500}
      />
    </>
  )
}
