// react hooks
import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
// mui components
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  IconButton
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
// internal components
import { NotionalTransferSummary } from '@/views/NotionalTransfers/NotionalTransferSummary'
import { OtherUsesSummary } from '@/views/OtherUses/OtherUsesSummary'
// constants
import { ROUTES } from '@/constants/routes'
import { roles } from '@/constants/roles'
import { Role } from '@/components/Role'

const ReportDetails = (props) => {
  const { t } = useTranslation()
  const { compliancePeriod, complianceReportId } = useParams()
  const navigate = useNavigate()

  const reportActivities = useMemo(
    () => [
      {
        name: t('report:activityLists.supplyOfFuel'),
        action: () => {
          navigate(
            ROUTES.REPORTS_ADD_SUPPLY_OF_FUEL.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          )
        }
      },
      {
        name: t('report:activityLists.finalSupplyEquipment'),
        action: () => {
          navigate(
            ROUTES.REPORTS_ADD_FINAL_SUPPLY_EQUIPMENTS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          )
        }
      },
      {
        name: t('report:activityLists.allocationAgreements'),
        action: () => {
          navigate(
            ROUTES.REPORTS_ADD_ALLOCATION_AGREEMENTS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          )
        }
      },
      {
        name: t('report:activityLists.notionalTransfers'),
        action: () => {
          navigate(
            ROUTES.REPORTS_ADD_NOTIONAL_TRANSFERS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          )
        },
        component: (
          <NotionalTransferSummary compliancePeriod={compliancePeriod} />
        )
      },
      {
        name: t('otherUses:summaryTitle'),
        action: () => {
          navigate(
            ROUTES.REPORTS_ADD_OTHER_USE_FUELS.replace(
              ':complianceReportId',
              complianceReportId
            ).replace(':compliancePeriod', compliancePeriod)
          )
        },
        component: <OtherUsesSummary compliancePeriod={compliancePeriod} />
      },
      {
        name: t('report:activityLists.exportFuels'),
        action: () => {
          navigate(
            ROUTES.REPORTS_ADD_EXPORT_FUELS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          )
        }
      }
    ],
    []
  )
  const [expanded, setExpanded] = useState(() =>
    reportActivities.map((_, index) => `panel${index}`)
  )
  const handleChange = (panel) => (event, isExpanded) => {
    setExpanded((prev) =>
      isExpanded ? [...prev, panel] : prev.filter((p) => p !== panel)
    )
  }

  return (
    <>
      <Typography color="primary" variant="h5" component="div">
        {t('report:reportDetails')}
      </Typography>
      {reportActivities.map((activity, index) => (
        <Accordion
          key={index}
          expanded={expanded.includes(`panel${index}`)}
          onChange={handleChange(`panel${index}`)}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
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
              {activity.name}
              <Role
                roles={[
                  roles.supplier,
                  roles.compliance_reporting,
                  roles.compliance_reporting
                ]}
              >
                <IconButton
                  aria-label="edit"
                  size="medium"
                  color="primary"
                  onClick={activity.action}
                >
                  <EditIcon />
                </IconButton>
              </Role>
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {activity.component ? (
              activity.component
            ) : (
              <Typography>{t('common:detailsGoHere')}</Typography>
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </>
  )
}

export default ReportDetails
