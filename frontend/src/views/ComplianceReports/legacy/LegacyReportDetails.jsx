import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  CircularProgress,
  Link
} from '@mui/material'
import BCTypography from '@/components/BCTypography'

import { ROUTES, buildPath } from '@/routes/routes'
import { useGetAllNotionalTransfers } from '@/hooks/useNotionalTransfer'
import { ScheduleASummary } from '@/views/ComplianceReports/legacy/ScheduleASummary.jsx'
import { useGetAllOtherUses } from '@/hooks/useOtherUses.js'
import { ScheduleCSummary } from '@/views/ComplianceReports/legacy/ScheduleCSummary.jsx'
import { useGetFuelSupplies } from '@/hooks/useFuelSupply.js'
import { ScheduleBSummary } from '@/views/ComplianceReports/legacy/ScheduleBSummary.jsx'
import { useGetAllAllocationAgreements } from '@/hooks/useAllocationAgreement'
import { AllocationAgreementSummary } from '@/views/AllocationAgreements/AllocationAgreementSummary'
import { isArrayEmpty } from '@/utils/array.js'
import { ExpandMore } from '@mui/icons-material'

const LegacyReportDetails = ({ currentStatus = 'Draft' }) => {
  const { t } = useTranslation(['legacy', 'report'])
  const { compliancePeriod, complianceReportId } = useParams()
  const navigate = useNavigate()

  const activityList = useMemo(
    () => [
      {
        name: t('legacy:activityLists.scheduleA'),
        action: () =>
          navigate(
            buildPath(ROUTES.REPORTS.ADD.NOTIONAL_TRANSFERS, {
              compliancePeriod,
              complianceReportId
            })
          ),
        useFetch: useGetAllNotionalTransfers,
        component: (data) =>
          data.length > 0 && (
            <ScheduleASummary status={currentStatus} data={data} />
          )
      },
      {
        name: t('legacy:activityLists.scheduleB'),
        action: () =>
          navigate(
            buildPath(ROUTES.REPORTS.ADD.SUPPLY_OF_FUEL, {
              compliancePeriod,
              complianceReportId
            })
          ),
        useFetch: useGetFuelSupplies,
        component: (data) =>
          data.fuelSupplies.length > 0 && (
            <ScheduleBSummary status={currentStatus} data={data} />
          )
      },
      {
        name: t('legacy:activityLists.scheduleC'),
        action: () =>
          navigate(
            buildPath(ROUTES.REPORTS.ADD.OTHER_USE_FUELS, {
              compliancePeriod,
              complianceReportId
            })
          ),
        useFetch: useGetAllOtherUses,
        component: (data) =>
          data.length > 0 && (
            <ScheduleCSummary status={currentStatus} data={data} />
          )
      },
      {
        name: t('report:activityLists.allocationAgreements'),
        action: () =>
          navigate(
            buildPath(ROUTES.REPORTS.ADD.ALLOCATION_AGREEMENTS, {
              compliancePeriod,
              complianceReportId
            })
          ),
        useFetch: useGetAllAllocationAgreements,
        component: (data) =>
          data?.allocationAgreements?.length > 0 && (
            <AllocationAgreementSummary status={currentStatus} data={data} />
          )
      }
    ],
    [t, complianceReportId, navigate, compliancePeriod, currentStatus]
  )

  const [expanded, setExpanded] = useState(
    activityList
      .map((activity, index) => {
        if (activity.name === t('report:supportingDocs')) {
          return isArrayEmpty(activity.useFetch(complianceReportId).data)
            ? ''
            : `panel${index}`
        }
        return `panel${index}`
      })
      .filter(Boolean)
  )

  const onExpand = (panel) => (event, isExpanded) => {
    setExpanded((prev) =>
      isExpanded ? [...prev, panel] : prev.filter((p) => p !== panel)
    )
  }

  const onExpandAll = () => {
    setExpanded(activityList.map((_, index) => `panel${index}`))
  }

  const onCollapseAll = () => {
    setExpanded([])
  }

  return (
    <>
      <BCTypography color="primary" variant="h5" mb={2} component="div">
        {t('report:reportDetails')}
        <Link
          component="button"
          variant="body2"
          onClick={onExpandAll}
          sx={{ ml: 2, mr: 1, textDecoration: 'underline' }}
        >
          {t('report:expandAll')}
        </Link>
        |
        <Link
          component="button"
          variant="body2"
          onClick={onCollapseAll}
          sx={{ ml: 1, textDecoration: 'underline' }}
        >
          {t('report:collapseAll')}
        </Link>
      </BCTypography>
      {activityList.map((activity, index) => {
        const { data, error, isLoading } = activity.useFetch(complianceReportId)
        return (
          ((data && !isArrayEmpty(data)) ||
            activity.name === t('report:supportingDocs')) && (
            <Accordion
              key={index}
              expanded={
                activity.name === t('report:supportingDocs')
                  ? expanded.includes(`panel${index}`) && !isArrayEmpty(data)
                  : expanded.includes(`panel${index}`)
              }
              onChange={onExpand(`panel${index}`)}
            >
              <AccordionSummary
                expandIcon={
                  <ExpandMore sx={{ width: '2rem', height: '2rem' }} />
                }
                aria-controls={`panel${index}-content`}
                id={`panel${index}-header`}
                data-test={`panel${index}-summary`}
              >
                <BCTypography
                  style={{ display: 'flex', alignItems: 'center' }}
                  variant="h6"
                  color="primary"
                  component="div"
                >
                  {activity.name}&nbsp;&nbsp;
                </BCTypography>
              </AccordionSummary>
              <AccordionDetails>
                {isLoading ? (
                  <CircularProgress />
                ) : error ? (
                  <BCTypography color="error">Error loading data</BCTypography>
                ) : activity.component ? (
                  activity.component(data)
                ) : (
                  <BCTypography>{JSON.stringify(data)}</BCTypography>
                )}
              </AccordionDetails>
            </Accordion>
          )
        )
      })}
    </>
  )
}

export default LegacyReportDetails
