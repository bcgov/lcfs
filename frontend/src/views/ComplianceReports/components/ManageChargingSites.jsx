import React, { useCallback, useState } from 'react'
import { Stack } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import BCBadge from '@/components/BCBadge'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { CommonArrayRenderer } from '@/utils/grid/cellRenderers.jsx'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'

const chargingSitesColDefs = (t) => [
  {
    field: 'status',
    headerName: t('chargingSites:status', 'Status'),
    width: 120,
    filterable: true,
    sortable: true,
    cellRenderer: (params) => (
      <BCBox
        m={1}
        sx={{
          display: 'flex',
          justifyContent: 'center'
        }}
      >
        <BCBadge
          badgeContent={params.value}
          color={params.value === 'Active' ? 'success' : 'info'}
          variant="contained"
          size="lg"
          sx={{
            '& .MuiBadge-badge': {
              minWidth: '120px',
              fontWeight: 'regular',
              fontSize: '0.875rem',
              padding: '0.4em 0.6em'
            }
          }}
        />
      </BCBox>
    )
  },
  {
    field: 'siteName',
    headerName: t('chargingSites:siteName', 'Site name'),
    width: 200,
    filterable: true,
    sortable: true,
    flex: 1
  },
  {
    field: 'siteNumber',
    headerName: t('chargingSites:siteNumber', 'Site number'),
    width: 120,
    type: 'number',
    sortable: true
  },
  {
    field: 'streetAddress',
    headerName: t('chargingSites:streetAddress', 'Street address'),
    width: 250,
    sortable: true,
    flex: 1
  },
  {
    field: 'city',
    headerName: t('chargingSites:city', 'City'),
    width: 150,
    filterable: true,
    sortable: true
  },
  {
    field: 'postalCode',
    headerName: t('chargingSites:postalCode', 'Postal code'),
    width: 120,
    sortable: true
  },
  {
    field: 'intendedUsers',
    headerName: t('chargingSites:intendedUsers', 'Intended users'),
    width: 180,
    sortable: false,
    cellRenderer: (params) => (
      <CommonArrayRenderer
        {...params}
        disableLink={true}
      />
    )
  },
  {
    field: 'siteNotes',
    headerName: t('chargingSites:siteNotes', 'Site notes'),
    width: 200,
    sortable: true,
    flex: 1
  }
]

export const ManageChargingSites = ({ paginationOptions, setPaginationOptions, handleClearFilters }) => {
  const { t } = useTranslation(['common', 'report'])

  // Placeholder data for charging sites
  const chargingSitesData = [
    {
      id: 1,
      status: 'Active',
      siteName: 'Downtown Charging Hub',
      siteNumber: 101,
      streetAddress: '123 Main Street',
      city: 'Vancouver',
      postalCode: 'V6B 2W5',
      intendedUsers: ['Public', 'Employee'],
      siteNotes: 'Primary downtown location with high traffic'
    },
    {
      id: 2,
      status: 'Pending',
      siteName: 'Airport Terminal Station',
      siteNumber: 102,
      streetAddress: '3211 Grant McConachie Way',
      city: 'Richmond',
      postalCode: 'V7B 0A4',
      intendedUsers: ['Public'],
      siteNotes: 'Located near terminal building entrance'
    },
    {
      id: 3,
      status: 'Active',
      siteName: 'University Campus Hub',
      siteNumber: 103,
      streetAddress: '2329 West Mall',
      city: 'Vancouver',
      postalCode: 'V6T 1Z4',
      intendedUsers: ['Employee'],
      siteNotes: 'Campus-only access during business hours'
    }
  ]

  const getChargingSitesRowId = useCallback(
    (params) => params.data.id,
    []
  )

  return (
    <BCBox>
      <BCTypography variant="body2" sx={{ mb: 2 }}>
        {t(
          'report:chargingSitesDescription',
          'Create new charging site locations where you want to add FSE. Charging sites must be created before adding FSE.'
        )}
      </BCTypography>
      <Stack
        direction="row"
        spacing={2}
        useFlexGap
        flexWrap="wrap"
        my={2}
      >
        <BCButton
          variant="contained"
          size="small"
          color="primary"
          startIcon={
            <FontAwesomeIcon
              icon={faCirclePlus}
              className="small-icon"
              size="2x"
            />
          }
        >
          <BCTypography variant="subtitle2">
            {t('report:newChargingSiteBtn', 'New charging site')}
          </BCTypography>
        </BCButton>
        <ClearFiltersButton
          onClick={handleClearFilters}
          sx={{
            display: 'flex',
            alignItems: 'center'
          }}
        />
      </Stack>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridKey="charging-sites-grid"
          columnDefs={chargingSitesColDefs(t)}
          getRowId={getChargingSitesRowId}
          overlayNoRowsTemplate={t('chargingSites:noSitesFound', 'No charging sites found')}
          autoSizeStrategy={{
            type: 'fitGridWidth',
            defaultMinWidth: 50,
            defaultMaxWidth: 600
          }}
          queryData={{
            data: { 
              chargingSites: chargingSitesData,
              pagination: {
                page: 1,
                size: 10,
                total: chargingSitesData.length,
                totalPages: 1
              }
            },
            isLoading: false,
            error: null
          }}
          dataKey="chargingSites"
          paginationOptions={paginationOptions}
          onPaginationChange={(newPagination) => {
            setPaginationOptions(newPagination)
          }}
        />
      </BCBox>
    </BCBox>
  )
}