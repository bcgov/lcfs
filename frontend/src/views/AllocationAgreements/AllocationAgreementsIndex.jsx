import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import OrganizationList from '@/views/Transactions/components/OrganizationList'
import { useGetAllocationAgreementsIndex } from '@/hooks/useAllocationAgreement'
import { ROUTES, buildPath } from '@/routes/routes'
import {
  allocationAgreementsIndexColDefs,
  allocationAgreementsIndexDefaultColDef
} from './_indexSchema'

const ORG_FILTER_STORAGE_KEY = 'allocation-agreements-index-orgFilter'
const NO_ORG = { id: null, label: null, name: null }

const initialPaginationOptions = {
  page: 1,
  size: 25,
  sortOrders: [],
  filters: []
}

const readSavedOrg = () => {
  try {
    const saved = sessionStorage.getItem(ORG_FILTER_STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch (error) {
    console.warn('Failed to read saved organization filter:', error)
  }
  return NO_ORG
}

/**
 * IDIR index of allocation agreements across every non-Draft compliance
 * report version. Read-only: rows open the compliance report they belong to.
 */
export const AllocationAgreementsIndex = () => {
  const { t } = useTranslation(['allocationAgreement', 'common'])
  const navigate = useNavigate()
  const gridRef = useRef()

  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )
  const [selectedOrg, setSelectedOrg] = useState(readSavedOrg)

  const queryData = useGetAllocationAgreementsIndex(
    { ...paginationOptions, organizationId: selectedOrg?.id },
    { staleTime: 0 }
  )

  const columnDefs = useMemo(() => allocationAgreementsIndexColDefs(), [])

  const updateOrgFilter = useCallback((org) => {
    setSelectedOrg(org)
    // A different organization is a different result set: back to page 1,
    // keeping the grid's own filters and sort.
    setPaginationOptions((prev) => ({ ...prev, page: 1 }))
    try {
      if (org.id && org.label) {
        sessionStorage.setItem(ORG_FILTER_STORAGE_KEY, JSON.stringify(org))
      } else {
        sessionStorage.removeItem(ORG_FILTER_STORAGE_KEY)
      }
    } catch (error) {
      console.warn('Failed to persist organization filter:', error)
    }
  }, [])

  const resetGridFiltersState = useCallback(() => {
    setPaginationOptions(initialPaginationOptions)
    updateOrgFilter(NO_ORG)
  }, [updateOrgFilter])

  const filterToolbarConfig = useMemo(() => {
    if (!selectedOrg.id || !selectedOrg.label) {
      return { additionalPills: [] }
    }
    return {
      additionalPills: [
        {
          id: `organization-${selectedOrg.id}`,
          label: t('common:Organization', 'Organization'),
          value: selectedOrg.name,
          type: 'select',
          onRemove: () => updateOrgFilter(NO_ORG)
        }
      ]
    }
  }, [selectedOrg, t, updateOrgFilter])

  const getRowId = useCallback(
    (params) => String(params.data.allocationAgreementId),
    []
  )

  const onRowClicked = useCallback(
    ({ data }) => {
      if (!data?.complianceReportId) return
      navigate(
        buildPath(ROUTES.REPORTS.VIEW, {
          compliancePeriod: data.compliancePeriod,
          complianceReportId: data.complianceReportId
        })
      )
    },
    [navigate]
  )

  return (
    <>
      <BCTypography variant="h5" color="primary">
        {t('allocationAgreement:allocationAgreementIndex.title')}
      </BCTypography>
      <BCTypography variant="body2" color="text.secondary" my={2}>
        {t('allocationAgreement:allocationAgreementIndex.description')}
      </BCTypography>
      <OrganizationList
        selectedOrg={selectedOrg}
        onOrgChange={updateOrgFilter}
        onlyRegistered={false}
        showSelectedLabel={false}
        label={`${t('allocationAgreement:allocationAgreementIndex.showAgreementsInvolve')}:`}
        placeholder={t(
          'allocationAgreement:allocationAgreementIndex.selectOrganization'
        )}
      />
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridRef={gridRef}
          gridKey="allocation-agreements-index-grid"
          columnDefs={columnDefs}
          defaultColDef={allocationAgreementsIndexDefaultColDef}
          getRowId={getRowId}
          onRowClicked={onRowClicked}
          overlayNoRowsTemplate={t(
            'allocationAgreement:noAllocationAgreementsFound'
          )}
          queryData={queryData}
          dataKey="allocationAgreements"
          paginationOptions={paginationOptions}
          onPaginationChange={(newPagination) =>
            setPaginationOptions((prev) => ({ ...prev, ...newPagination }))
          }
          filterToolbarConfig={filterToolbarConfig}
          onClearFilters={resetGridFiltersState}
        />
      </BCBox>
    </>
  )
}
