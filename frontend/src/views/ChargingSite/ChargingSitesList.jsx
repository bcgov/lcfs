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
import { useState, useMemo, useRef } from 'react'
import { Autocomplete, Box, Grid, TextField } from '@mui/material'
import { useOrganizationNames } from '@/hooks/useOrganizations'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { idirChargingSitesColDefs, idirDefaultColDef } from './_schema'
import { useGetAllChargingSites } from '@/hooks/useChargingSite'

export const ChargingSitesList = ({ alertRef }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation(['report'])
  const { hasAnyRole } = useCurrentUser()
  const isIDIR = hasAnyRole(...govRoles)
  const gridRef = useRef(null)
  const [selectedOrg, setSelectedOrg] = useState({ id: null, label: null })
  const [paginationOptions, setPaginationOptions] = useState({
    page: 1,
    size: 10,
    sortOrders: [],
    filters: []
  })

  const handleNewSite = () => {
    navigate(ROUTES.REPORTS.ADD_CHARGING_SITE)
  }

  // Check if we're on a nested route (like /add or /:id/edit)
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
    () => idirChargingSitesColDefs(orgIdToName),
    [orgIdToName]
  )

  const queryData = useGetAllChargingSites(paginationOptions, {
    enabled: true
  })

  const handleClearFilters = () => {
    setPaginationOptions({ page: 1, size: 10, sortOrders: [], filters: [] })
    setSelectedOrg({ id: null, label: null })
    try {
      gridRef.current?.clearFilters?.()
    } catch (e) {
      // no-op
    }
  }

  if (isIDIR) {
    // IDIR view with filters and grid
    return (
      <>
        {!isOnNestedRoute && (
          <>
            <BCTypography variant="h5" color="primary">
              {t('tabs.chargingSites')}
            </BCTypography>
            <BCTypography variant="body2" color="text.secondary" my={2}>
              {t('idirChargingSites.description')}
            </BCTypography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} lg={7}>
                <ClearFiltersButton onClick={handleClearFilters} />
              </Grid>
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
                    {t('idirChargingSites.filtersLabel')}
                  </BCTypography>
                  <Autocomplete
                    disablePortal
                    id="idir-orgs"
                    loading={orgLoading}
                    options={orgNames}
                    getOptionLabel={(option) => option.name}
                    onChange={(event, option) => {
                      const id = option?.organizationId || null
                      const label = option?.name || null
                      setSelectedOrg({ id, label })
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
                    }}
                    sx={({ functions: { pxToRem } }) => ({
                      width: 300,
                      '& .MuiOutlinedInput-root': { padding: pxToRem(0) }
                    })}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder={t(
                          'idirChargingSites.selectOrgPlaceholder',
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
            </Grid>
            <BCBox
              component="div"
              sx={{ mt: 2, height: '100%', width: '100%' }}
            >
              <BCGridViewer
                gridRef={gridRef}
                gridKey="idir-charging-sites-grid"
                columnDefs={idirColumnDefs}
                defaultColDef={idirDefaultColDef}
                queryData={queryData}
                dataKey="chargingSites"
                autoSizeStrategy={{ type: 'fitGridWidth', defaultMinWidth: 80 }}
                paginationOptions={paginationOptions}
                onPaginationChange={setPaginationOptions}
                getRowId={(p) => String(p.data?.chargingSiteId || p.node?.id)}
              />
            </BCBox>
          </>
        )}
        <Outlet />
      </>
    )
  }
}
