import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  CircularProgress
} from '@mui/material'
import { faEdit } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { NotionalTransferSummary } from '@/views/NotionalTransfers/NotionalTransferSummary'
import { ROUTES } from '@/constants/routes'
import { roles } from '@/constants/roles'
import { Role } from '@/components/Role'
import { OtherUsesSummary } from '@/views/OtherUses/OtherUsesSummary'
import { useGetFinalSupplyEquipments } from '@/hooks/useFinalSupplyEquipment'
import { FinalSupplyEquipmentSummary } from '@/views/FinalSupplyEquipments/FinalSupplyEquipmentSummary'
import { useGetAllNotionalTransfers } from '@/hooks/useNotionalTransfer'
import { useGetAllOtherUses } from '@/hooks/useOtherUses'

const ReportDetails = () => {
  const { t } = useTranslation()
  const { compliancePeriod, complianceReportId } = useParams()
  const navigate = useNavigate()

  const activityList = useMemo(
    () => [
      {
        name: t('report:activityLists.supplyOfFuel'),
        action: () =>
          navigate(
            ROUTES.REPORTS_ADD_SUPPLY_OF_FUEL.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          ),
        useFetch: async () => ({
          data: [],
          isLoading: false,
          isError: false,
          isFetched: true
        }),
        component: (data) => <></>
      },
      {
        name: t('finalSupplyEquipment:fseTitle'),
        action: () =>
          navigate(
            ROUTES.REPORTS_ADD_FINAL_SUPPLY_EQUIPMENTS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          ),
        useFetch: useGetFinalSupplyEquipments,
        component: (data) =>
          data.finalSupplyEquipments.length > 0 && (
            <FinalSupplyEquipmentSummary data={data} />
          )
      },
      {
        name: t('report:activityLists.allocationAgreements'),
        action: () =>
          navigate(
            ROUTES.REPORTS_ADD_ALLOCATION_AGREEMENTS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          ),
        useFetch: async () => ({
          data: [],
          isLoading: false,
          isError: false,
          isFetched: true
        }),
        component: (data) => <></>
      },
      {
        name: t('report:activityLists.notionalTransfers'),
        action: () =>
          navigate(
            ROUTES.REPORTS_ADD_NOTIONAL_TRANSFERS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          ),
        useFetch: useGetAllNotionalTransfers,
        component: (data) => data.length > 0 && <NotionalTransferSummary data={data} />
      },
      {
        name: t('otherUses:summaryTitle'),
        action: () =>
          navigate(
            ROUTES.REPORTS_ADD_OTHER_USE_FUELS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          ),
        useFetch: useGetAllOtherUses,
        component: (data) => data.length > 0 && <OtherUsesSummary data={data} />
      },
      {
        name: t('report:activityLists.exportFuels'),
        action: () =>
          navigate(
            ROUTES.REPORTS_ADD_EXPORT_FUELS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          ),
        useFetch: async () => ({
          data: [],
          isLoading: false,
          isError: false,
          isFetched: true
        }),
        component: (data) => <></>
      }
    ],
    [t, navigate, compliancePeriod, complianceReportId]
  )

  const [expanded, setExpanded] = useState(() =>
    activityList.map((_, index) => `panel${index}`)
  )

  const handleChange = (panel) => (event, isExpanded) => {
    setExpanded((prev) =>
      isExpanded ? [...prev, panel] : prev.filter((p) => p !== panel)
    )
  }

  return (
    <>
      <Typography color="primary" variant="h5" mb={2} component="div">
        {t('report:reportDetails')}
      </Typography>
      {activityList.map((activity, index) => {
        const { data, error, isLoading } = activity.useFetch(complianceReportId)
        return (
          <Accordion
            key={index}
            expanded={expanded.includes(`panel${index}`)}
            onChange={handleChange(`panel${index}`)}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ width: '2rem', height: '2rem' }} />}
              aria-controls={`panel${index}-content`}
              id={`panel${index}-header`}
              data-test={`panel${index}-summary`}
            >
              <Typography
                variant="h6"
                color="primary"
                component="div"
                sx={{ fontSize: '18px' }}
              >
                {activity.name}&nbsp;&nbsp;
                <Role
                  roles={[
                    roles.supplier,
                    roles.compliance_reporting,
                    roles.compliance_reporting
                  ]}
                >
                  <FontAwesomeIcon
                    component="div"
                    icon={faEdit}
                    size={'lg'}
                    onClick={activity.action}
                  />
                </Role>
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {isLoading ? (
                <CircularProgress />
              ) : error ? (
                <Typography color="error">Error loading data</Typography>
              ) : activity.component ? (
                activity.component(data)
              ) : (
                <Typography>{JSON.stringify(data)}</Typography>
              )}
            </AccordionDetails>
          </Accordion>
        )
      })}
    </>
  )
}

export default ReportDetails